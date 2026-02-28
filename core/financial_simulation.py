"""
Financial Simulation Engine — fully deterministic, no LLM.
Computes runway, burn multiple, dilution, bankruptcy projection, and capital efficiency.
"""
from utils.models import StartupProfile, FinancialSimulationResult


def run_financial_simulation(startup: StartupProfile) -> FinancialSimulationResult:
    """Run deterministic financial projections for a startup.

    Args:
        startup: Extracted startup profile with financial fields.

    Returns:
        FinancialSimulationResult: Computed financial metrics.
    """
    revenue = startup.revenue_usd if startup.revenue_usd is not None else 0.0
    burn = startup.burn_rate_usd_monthly if startup.burn_rate_usd_monthly is not None else 0.0
    growth_rate = (startup.growth_rate_pct if startup.growth_rate_pct is not None else 0.0) / 100.0  # e.g. 0.20 for 20%
    raise_amount = startup.raise_amount_usd if startup.raise_amount_usd is not None else 0.0
    pre_money_val = startup.pre_money_valuation_usd if startup.pre_money_valuation_usd is not None else 0.0
    existing_cash = startup.existing_cash_usd if startup.existing_cash_usd is not None else 0.0

    # Net burn per month (burn minus monthly revenue)
    monthly_revenue = revenue / 12.0
    net_burn = max(burn - monthly_revenue, 0.0)

    # Runway: existing cash + new raise divided by net burn
    total_cash = existing_cash + raise_amount
    runway_months = (total_cash / net_burn) if net_burn > 0 else 999.0

    # Burn multiple: amount burned per dollar of net new ARR
    # Net new ARR = revenue * growth_rate
    net_new_arr = revenue * growth_rate
    annual_burn = burn * 12.0
    burn_multiple = (annual_burn / net_new_arr) if net_new_arr > 0 else 999.0

    # Dilution: new shares / post-money * 100
    post_money_val = pre_money_val + raise_amount
    dilution_pct = (raise_amount / post_money_val) * 100.0

    # Bankruptcy projection: months until cash runs out WITHOUT new raise
    bankruptcy_projection_months = (existing_cash / net_burn) if net_burn > 0 else 999.0

    # Capital efficiency ratio: ARR / total capital raised (raise + existing)
    capital_efficiency_ratio = revenue / total_cash if total_cash > 0 else 0.0

    return FinancialSimulationResult(
        runway_months=round(runway_months, 1),
        burn_multiple=round(burn_multiple, 2),
        dilution_pct=round(dilution_pct, 1),
        bankruptcy_projection_months=round(bankruptcy_projection_months, 1),
        capital_efficiency_ratio=round(capital_efficiency_ratio, 4),
    )
