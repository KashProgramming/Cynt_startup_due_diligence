"""
Market Validation Agent — validates TAM/growth claims against external market signals.
"""
from langchain_core.messages import HumanMessage, SystemMessage

from utils.llm import get_llm, extract_json
from utils.models import StartupProfile, MarketSignals, MarketValidationOutput

_SYSTEM = """You are a rigorous startup market validation analyst.
Expect startups to downplay competition. Your job is to be skeptical.
Score 0–100 (100 = strongest/best). Apply rubric strictly.
Low saturation (100) is EXTREMELY RARE. High saturation (0) is common in crowded sectors.
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
- Composite Signal Score: {composite}

Scoring Rubrics (BE CRITICAL):
- market_momentum_score: How much real-world demand exists? Base on composite signal + growth plausibility.
- hype_vs_evidence_delta: (claimed_growth/100) - (composite/100). Higher = more likely to be a bubble or over-claimed.
- competitive_saturation_score: 
    - 90-100: Only for 'Blue Ocean' inventions with zero direct or indirect substitutes (rare).
    - 70-89: Niche markets with 1-2 minor competitors.
    - 40-69: Moderate competition (3-5 direct competitors mentioned).
    - 10-39: Highly saturated or 'Red Ocean' (SaaS, AI Wrappers, Crypto, etc.) or if 'None identified' (implies poor founder research).
    - Note: If Composite Signal is HIGH (>70), it usually indicates a crowded, competitive market. Lower the score accordingly.

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
        composite=signals.composite_signal_score,
    )

    llm = get_llm()
    response = llm.invoke([
        SystemMessage(content=_SYSTEM),
        HumanMessage(content=prompt),
    ])
    data = extract_json(response.content)
    return MarketValidationOutput(**data)
