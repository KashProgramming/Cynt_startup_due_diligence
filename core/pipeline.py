"""
Pipeline Orchestrator — async coordination of all processing modules and agents.
Runs non-dependent tasks concurrently, feeds outputs through the pipeline in order.
"""
import asyncio
import logging
import re
from concurrent.futures import ThreadPoolExecutor

from utils.models import (
    StartupProfile,
    InvestorPortfolio,
    MarketSignals,
    DueDiligenceResult,
    LinkedInProfile,
    LinkedInLocation,
)
from core.financial_simulation import run_financial_simulation
from core.market_signals import fetch_market_signals
from core.memo_generator import generate_memo
from agents.financial_risk_agent import run_financial_risk_agent
from agents.market_validation_agent import run_market_validation_agent
from agents.founder_intelligence_agent import run_founder_intelligence_agent
from agents.investment_decision_engine import run_investment_decision_engine

_executor = ThreadPoolExecutor(max_workers=6)
logger = logging.getLogger(__name__)


def _run_in_thread(fn, *args):
    """Helper to run a synchronous function in the thread pool."""
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(_executor, fn, *args)


def _enrich_with_linkedin(startup: StartupProfile) -> None:
    """Attempt live LinkedIn enrichment via RapidAPI if not already set.

    Mutates startup.linkedin_profile in-place.
    Only activates when:
      - startup.linkedin_profile is None (MongoDB fetch in document_processor found nothing), AND
      - A LinkedIn URL is detectable in founder_background text.

    Fully safe: any failure is caught and logged; pipeline continues unaffected.
    """
    # Already enriched by document_processor (MongoDB hit) — skip
    if startup.linkedin_profile is not None:
        return

    # Try to extract a LinkedIn URL from the founder background text
    linkedin_url = None
    if startup.founder_background:
        match = re.search(
            r"https?://(?:www\.)?linkedin\.com/in/[A-Za-z0-9_%-]+",
            startup.founder_background,
        )
        if match:
            linkedin_url = match.group(0)

    if not linkedin_url:
        logger.info("No LinkedIn URL found in founder_background — skipping live scrape.")
        return

    try:
        from utils.linkedin_scraper import extract_username, fetch_linkedin_profile, map_linkedin_to_profile

        username = extract_username(linkedin_url)
        logger.info(f"🔍 Attempting live LinkedIn scrape for username: {username}")

        raw = fetch_linkedin_profile(username)
        mapped = map_linkedin_to_profile(raw)

        # Convert SimpleNamespace → LinkedInProfile Pydantic model
        location = None
        if mapped.location and (mapped.location.city or mapped.location.country):
            location = LinkedInLocation(
                city=mapped.location.city,
                country=mapped.location.country,
            )

        startup.linkedin_profile = LinkedInProfile(
            full_name=mapped.full_name or startup.founder_name,
            headline=mapped.headline,
            is_premium=mapped.is_premium,
            is_open_to_work=mapped.is_open_to_work,
            is_hiring=mapped.is_hiring,
            is_influencer=mapped.is_influencer,
            is_top_voice=mapped.is_top_voice,
            is_creator=mapped.is_creator,
            created_date=mapped.created_date,
            location=location,
        )
        logger.info(f"✅ Live LinkedIn profile set for {startup.founder_name}")

    except ValueError as e:
        # RAPIDAPI_KEY not configured — warn and continue with fallback
        logger.warning(f"LinkedIn live scrape skipped (config issue): {e}")
    except Exception as e:
        logger.warning(f"⚠️ LinkedIn live scrape failed for {startup.founder_name}: {e}")


async def run_pipeline(
    startup: StartupProfile,
    portfolio: InvestorPortfolio,
) -> DueDiligenceResult:
    """Run the full due diligence pipeline asynchronously.

    Execution order:
    1. Financial simulation + Market signals run concurrently (no dependencies).
    1b. LinkedIn enrichment (live RapidAPI fallback, non-blocking).
    2. All three agents (financial risk, market validation, founder intelligence)
       run concurrently once their inputs are ready.
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

    # ── Stage 1b: LinkedIn enrichment (live fallback, safe) ───────────────────
    await _run_in_thread(_enrich_with_linkedin, startup)

    # ── Stage 2: Parallel agent runs ──────────────────────────────────────────
    def _financial_risk():
        return run_financial_risk_agent(startup, simulation)

    def _market_validation():
        return run_market_validation_agent(startup, market_signals)

    def _founder_intelligence():
        return run_founder_intelligence_agent(startup)

    (
        financial_risk,
        market_validation,
        founder_intelligence,
    ) = await asyncio.gather(
        _run_in_thread(_financial_risk),
        _run_in_thread(_market_validation),
        _run_in_thread(_founder_intelligence),
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
        investment_decision=investment_decision,
        memo="",  # placeholder until generated below
    )
    result.memo = generate_memo(result)

    return result


if __name__ == "__main__":
    """Smoke test — verifies live LinkedIn scrape, mapping, and full pipeline run."""
    import asyncio
    from utils.models import InvestorType

    logging.basicConfig(level=logging.INFO)

    test_startup = StartupProfile(
        company_name="TestCo AI",
        sector="artificial intelligence",
        stage="Seed",
        geography="India",
        tam_usd_millions=800.0,
        market_problem="Inefficient hiring workflows",
        competitive_advantages=["speed", "AI accuracy"],
        competitors=["LinkedIn", "Naukri"],
        revenue_usd=120000.0,
        raise_amount_usd=1000000.0,
        founder_name="Kashish Mandhane",
        founder_background=(
            "Ex-AI/ML Intern at K2S2 Digistrat. Published researcher. "
            "LinkedIn: https://www.linkedin.com/in/kashishmandhane"
        ),
        prior_exits=0,
        domain_years_experience=2,
        notable_investors_or_advisors=[],
    )

    test_portfolio = InvestorPortfolio(
        investor_type=InvestorType.ANGEL,
        portfolio_sectors=["AI", "SaaS"],
        portfolio_stages=["Seed"],
        portfolio_geographies=["India"],
        check_size_range_usd=(10000.0, 500000.0),
        total_investments=5,
    )

    result = asyncio.run(run_pipeline(test_startup, test_portfolio))

    print("\n=== LINKEDIN PROFILE USED ===")
    print(result.startup.linkedin_profile)
    print("\n=== FOUNDER INTELLIGENCE ===")
    print(result.founder_intelligence)
    print("\n=== INVESTMENT DECISION ===")
    print(result.investment_decision)
