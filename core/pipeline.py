"""
Pipeline Orchestrator — async coordination of all processing modules and agents.
Runs non-dependent tasks concurrently, feeds outputs through the pipeline in order.
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor

from utils.models import (
    StartupProfile,
    InvestorPortfolio,
    MarketSignals,
    DueDiligenceResult,
)
from core.financial_simulation import run_financial_simulation
from core.market_signals import fetch_market_signals
from core.memo_generator import generate_memo
from agents.financial_risk_agent import run_financial_risk_agent
from agents.market_validation_agent import run_market_validation_agent
from agents.founder_intelligence_agent import run_founder_intelligence_agent
from agents.portfolio_fit_module import run_portfolio_fit_module
from agents.investment_decision_engine import run_investment_decision_engine

_executor = ThreadPoolExecutor(max_workers=6)


def _run_in_thread(fn, *args):
    """Helper to run a synchronous function in the thread pool."""
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(_executor, fn, *args)


async def run_pipeline(
    startup: StartupProfile,
    portfolio: InvestorPortfolio,
) -> DueDiligenceResult:
    """Run the full due diligence pipeline asynchronously.

    Execution order:
    1. Financial simulation + Market signals run concurrently (no dependencies).
    2. All three agents (financial risk, market validation, founder intelligence)
       + portfolio fit run concurrently once their inputs are ready.
    3. Investment decision engine runs after all scores are collected.
    4. Memo is generated deterministically.

    Args:
        startup: Extracted startup profile.
        portfolio: Investor portfolio context.

    Returns:
        DueDiligenceResult: Complete due diligence output.
    """

    # ── Stage 1: Parallel deterministic computations ──────────────────────────
    simulation_future = _run_in_thread(run_financial_simulation, startup)
    signals_future = _run_in_thread(
        fetch_market_signals, startup.sector, startup.competitors
    )

    simulation, raw_signals = await asyncio.gather(simulation_future, signals_future)
    market_signals = MarketSignals(**raw_signals)

    # ── Stage 2: Parallel agent runs ──────────────────────────────────────────
    def _financial_risk():
        return run_financial_risk_agent(startup, simulation)

    def _market_validation():
        return run_market_validation_agent(startup, market_signals)

    def _founder_intelligence():
        return run_founder_intelligence_agent(startup)

    def _portfolio_fit():
        return run_portfolio_fit_module(startup, portfolio)

    (
        financial_risk,
        market_validation,
        founder_intelligence,
        portfolio_fit,
    ) = await asyncio.gather(
        _run_in_thread(_financial_risk),
        _run_in_thread(_market_validation),
        _run_in_thread(_founder_intelligence),
        _run_in_thread(_portfolio_fit),
    )

    # ── Stage 3: Meta-agent decision ──────────────────────────────────────────
    investment_decision = await _run_in_thread(
        run_investment_decision_engine,
        startup.company_name,
        startup.sector,
        startup.stage,
        startup.raise_amount_usd,
        financial_risk,
        market_validation,
        founder_intelligence,
        portfolio_fit,
        portfolio,
    )

    # ── Stage 4: Memo generation (deterministic) ──────────────────────────────
    result = DueDiligenceResult(
        startup=startup,
        financial_simulation=simulation,
        market_signals=market_signals,
        financial_risk=financial_risk,
        market_validation=market_validation,
        founder_intelligence=founder_intelligence,
        portfolio_fit=portfolio_fit,
        investment_decision=investment_decision,
        memo="",  # placeholder until generated below
    )
    result.memo = generate_memo(result)

    return result
