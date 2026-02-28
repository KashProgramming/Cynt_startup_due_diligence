"""
Financial Risk Agent — evaluates financial health and valuation sanity.
Calls Financial Simulation Engine and applies rubric-based LLM scoring.
"""
from langchain_core.messages import HumanMessage, SystemMessage

from utils.llm import get_llm, extract_json
from utils.models import StartupProfile, FinancialSimulationResult, FinancialRiskOutput

_SYSTEM = """You are a startup financial risk analyst.
Score 0–100 (100 = best/safest). Apply rubric strictly.
Respond ONLY with valid JSON, no explanation outside the JSON."""

_PROMPT = """Startup: {company} | Sector: {sector} | Stage: {stage}

Financial Simulation Results:
- Runway: {runway_months} months
- Burn Multiple: {burn_multiple} (good <1.5, danger >3)
- Dilution: {dilution_pct}%
- Bankruptcy projection (no new raise): {bankruptcy_months} months
- Capital Efficiency Ratio: {cap_eff} (ARR/capital)

Claims:
- Revenue: ${revenue:,.0f} ARR
- Monthly Burn: ${burn:,.0f}
- Raise: ${raise_amount:,.0f}
- Pre-money Valuation: ${val:,.0f}
- Growth Rate: {growth}% YoY

Valuation sanity: ARR multiple = {arr_multiple:.1f}x (flag if >50x for stage)

Return exactly:
{{
  "sustainability_score": int,
  "bankruptcy_timeline_months": int,
  "capital_efficiency_ratio": float,
  "valuation_realism_flag": bool,
  "key_financial_risks": [str, str, str]
}}"""


def run_financial_risk_agent(
    startup: StartupProfile,
    simulation: FinancialSimulationResult,
) -> FinancialRiskOutput:
    """Run the Financial Risk Agent.

    Args:
        startup: Extracted startup profile.
        simulation: Pre-computed financial simulation results.

    Returns:
        FinancialRiskOutput: Structured financial risk assessment.
    """
    arr_multiple = 9999
    if startup.pre_money_valuation_usd is not None and startup.revenue_usd > 0:
        arr_multiple = startup.pre_money_valuation_usd / startup.revenue_usd

    prompt = _PROMPT.format(
        company=startup.company_name,
        sector=startup.sector,
        stage=startup.stage,
        runway_months=simulation.runway_months,
        burn_multiple=simulation.burn_multiple,
        dilution_pct=simulation.dilution_pct,
        bankruptcy_months=simulation.bankruptcy_projection_months,
        cap_eff=simulation.capital_efficiency_ratio,
        revenue=startup.revenue_usd,
        burn=startup.burn_rate_usd_monthly or 0.0,
        raise_amount=startup.raise_amount_usd,
        val=startup.pre_money_valuation_usd or 0.0,
        growth=startup.growth_rate_pct or 0.0,
        arr_multiple=arr_multiple,
    )

    llm = get_llm()
    response = llm.invoke([
        SystemMessage(content=_SYSTEM),
        HumanMessage(content=prompt),
    ])
    data = extract_json(response.content)
    return FinancialRiskOutput(**data)
