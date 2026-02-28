"""
Market Validation Agent — validates TAM/growth claims against external market signals.
"""
from langchain_core.messages import HumanMessage, SystemMessage

from utils.llm import get_llm, extract_json
from utils.models import StartupProfile, MarketSignals, MarketValidationOutput

_SYSTEM = """You are a startup market validation analyst.
Score 0–100 (100 = strongest/best). Apply rubric strictly.
Respond ONLY with valid JSON, no explanation outside the JSON."""

_PROMPT = """Startup: {company} | Sector: {sector} | Stage: {stage}

Claimed Market Metrics:
- TAM: ${tam_millions:.0f}M
- Claimed YoY Growth: {growth}%
- Competitors: {competitors}
- Competitive Advantages: {advantages}

External Market Signals (0–100 each):
- Google Trends Score: {trends}
- News Frequency Score: {news}
- GitHub Activity Score: {github}
- Composite Signal Score: {composite}

Scoring rubrics:
- market_momentum_score: composite signal + growth plausibility
- hype_vs_evidence_delta: (claimed_growth/100) - (composite/100), range -1 to +1, *100 for output
- competitive_saturation_score: 100 - saturation (high score = less saturated = better)

Return exactly:
{{
  "market_momentum_score": int,
  "hype_vs_evidence_delta": float,
  "competitive_saturation_score": int,
  "key_market_risks": [str, str, str]
}}"""


def run_market_validation_agent(
    startup: StartupProfile,
    signals: MarketSignals,
) -> MarketValidationOutput:
    """Run the Market Validation Agent.

    Args:
        startup: Extracted startup profile.
        signals: External market signals from the Market Signal Connector.

    Returns:
        MarketValidationOutput: Structured market validation assessment.
    """
    prompt = _PROMPT.format(
        company=startup.company_name,
        sector=startup.sector,
        stage=startup.stage,
        tam_millions=startup.tam_usd_millions,
        growth=startup.growth_rate_pct,
        competitors=", ".join(startup.competitors) or "None identified",
        advantages=", ".join(startup.competitive_advantages) or "None listed",
        trends=signals.google_trends_score,
        news=signals.news_frequency_score,
        github=signals.github_activity_score,
        composite=signals.composite_signal_score,
    )

    llm = get_llm()
    response = llm.invoke([
        SystemMessage(content=_SYSTEM),
        HumanMessage(content=prompt),
    ])
    data = extract_json(response.content)
    return MarketValidationOutput(**data)
