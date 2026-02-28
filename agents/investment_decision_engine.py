"""
Investment Decision Engine (Meta-Agent) — aggregates all agent scores into a final
investment recommendation using dynamic weights per investor type.
"""
from langchain_core.messages import HumanMessage, SystemMessage

from utils.llm import get_llm, extract_json
from utils.models import (
    InvestorPortfolio,
    InvestorType,
    FinancialRiskOutput,
    MarketValidationOutput,
    FounderIntelligenceOutput,
    PortfolioFitOutput,
    InvestmentDecisionOutput,
    FinalDecision,
    CheckSizeTier,
)

# ─── Dynamic weight configs per investor type ─────────────────────────────────
# (w1_financial, w2_market, w3_founder, w4_portfolio, w5_competitive)
_WEIGHTS: dict[InvestorType, tuple[float, float, float, float, float]] = {
    InvestorType.ANGEL: (0.20, 0.20, 0.40, 0.10, 0.10),
    InvestorType.EARLY_VC: (0.25, 0.25, 0.30, 0.15, 0.05),
    InvestorType.ACCELERATOR: (0.15, 0.20, 0.40, 0.15, 0.10),
    InvestorType.COMMITTEE: (0.30, 0.25, 0.25, 0.15, 0.05),
}


def _compute_decision_score(
    financial_score: int,
    market_score: int,
    founder_score: int,
    portfolio_score: int,
    competitive_score: int,
    investor_type: InvestorType,
) -> float:
    """Apply weighted formula to compute final decision score.

    Args:
        financial_score: Financial risk sustainability score.
        market_score: Market momentum score.
        founder_score: Founder intelligence score.
        portfolio_score: Portfolio fit score.
        competitive_score: Competitive saturation score (inverted = opportunity).
        investor_type: Investor type for weight selection.

    Returns:
        float: Weighted decision score 0–100.
    """
    w1, w2, w3, w4, w5 = _WEIGHTS[investor_type]
    return round(
        w1 * financial_score
        + w2 * market_score
        + w3 * founder_score
        + w4 * portfolio_score
        + w5 * competitive_score,
        2,
    )


def _classify_decision(score: float, overexposure: bool) -> FinalDecision:
    """Map score to decision category.

    Args:
        score: Weighted decision score.
        overexposure: Whether portfolio overexposure flag is set.

    Returns:
        FinalDecision: Enumerated decision.
    """
    if overexposure and score < 75:
        return FinalDecision.WATCHLIST
    if score >= 75:
        return FinalDecision.INVEST
    if score >= 60:
        return FinalDecision.INVEST_WITH_CONDITIONS
    if score >= 45:
        return FinalDecision.WATCHLIST
    return FinalDecision.PASS


def _classify_check_size(
    raise_amount: float,
    check_range: tuple[float, float],
) -> CheckSizeTier:
    """Map raise amount vs investor range to a check size tier.

    Args:
        raise_amount: Startup's raise target.
        check_range: Investor's (min, max) check size.

    Returns:
        CheckSizeTier: SMALL, MEDIUM, or LARGE.
    """
    mid = (check_range[0] + check_range[1]) / 2
    if raise_amount < mid * 0.5:
        return CheckSizeTier.SMALL
    if raise_amount <= mid * 1.5:
        return CheckSizeTier.MEDIUM
    return CheckSizeTier.LARGE


_SYSTEM = """You are a senior investment committee member.
Given scored inputs, generate precise milestones and synthesize key risks.
Respond ONLY with valid JSON, no explanation outside the JSON."""

_PROMPT = """Startup: {company} | Sector: {sector} | Stage: {stage}
Decision Score: {score}/100 | Decision: {decision}
Investor Type: {investor_type}

Score Breakdown:
- Financial Risk (sustainability): {financial}/100
- Market Momentum: {market}/100
- Founder Intelligence: {founder}/100
- Portfolio Fit: {portfolio}/100
- Competitive Opportunity: {competitive}/100

Overexposure Flag: {overexposure}
Key financial risks: {fin_risks}
Key market risks: {mkt_risks}
Key founder risks: {fdr_risks}

Return exactly:
{{
  "key_risks": [str, str, str, str],
  "required_milestones": [str, str, str]
}}"""


def run_investment_decision_engine(
    startup_name: str,
    startup_sector: str,
    startup_stage: str,
    raise_amount: float,
    financial_risk: FinancialRiskOutput,
    market_validation: MarketValidationOutput,
    founder_intelligence: FounderIntelligenceOutput,
    portfolio_fit: PortfolioFitOutput,
    portfolio: InvestorPortfolio,
) -> InvestmentDecisionOutput:
    """Run the Investment Decision Engine meta-agent.

    Args:
        startup_name: Company name.
        startup_sector: Startup sector.
        startup_stage: Startup stage.
        raise_amount: Raise target in USD.
        financial_risk: Financial risk agent output.
        market_validation: Market validation agent output.
        founder_intelligence: Founder intelligence agent output.
        portfolio_fit: Portfolio fit module output.
        portfolio: Investor portfolio context.

    Returns:
        InvestmentDecisionOutput: Final investment recommendation.
    """
    decision_score = _compute_decision_score(
        financial_score=financial_risk.sustainability_score,
        market_score=market_validation.market_momentum_score,
        founder_score=founder_intelligence.founder_intelligence_score,
        portfolio_score=portfolio_fit.portfolio_fit_score,
        competitive_score=market_validation.competitive_saturation_score,
        investor_type=portfolio.investor_type,
    )

    decision = _classify_decision(decision_score, portfolio_fit.overexposure_flag)
    check_size_tier = _classify_check_size(raise_amount, portfolio.check_size_range_usd)

    # Use LLM only for narrative risks and milestones
    prompt = _PROMPT.format(
        company=startup_name,
        sector=startup_sector,
        stage=startup_stage,
        score=decision_score,
        decision=decision.value,
        investor_type=portfolio.investor_type.value,
        financial=financial_risk.sustainability_score,
        market=market_validation.market_momentum_score,
        founder=founder_intelligence.founder_intelligence_score,
        portfolio=portfolio_fit.portfolio_fit_score,
        competitive=market_validation.competitive_saturation_score,
        overexposure=portfolio_fit.overexposure_flag,
        fin_risks="; ".join(financial_risk.key_financial_risks),
        mkt_risks="; ".join(market_validation.key_market_risks),
        fdr_risks="; ".join(founder_intelligence.key_founder_risks),
    )

    llm = get_llm()
    response = llm.invoke([
        SystemMessage(content=_SYSTEM),
        HumanMessage(content=prompt),
    ])
    narrative = extract_json(response.content)

    return InvestmentDecisionOutput(
        final_decision=decision,
        decision_score=decision_score,
        key_risks=narrative.get("key_risks", []),
        required_milestones=narrative.get("required_milestones", []),
        suggested_check_size_tier=check_size_tier,
    )
