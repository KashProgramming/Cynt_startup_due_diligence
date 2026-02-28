"""
Memo Generation Module — template-based rendering of the full due diligence result.
No LLM; deterministic Jinja2 rendering only.
"""
from jinja2 import Template
from utils.models import DueDiligenceResult

_MEMO_TEMPLATE = """
================================================================================
INVESTMENT DUE DILIGENCE MEMO
================================================================================
Company:         {{ r.startup.company_name }}
Sector:          {{ r.startup.sector }}
Stage:           {{ r.startup.stage }}
Geography:       {{ r.startup.geography }}
Founder:         {{ r.startup.founder_name }}
Raise Target:    ${{ "{:,.0f}".format(r.startup.raise_amount_usd) }}
Pre-money Val:   ${{ "{:,.0f}".format(r.startup.pre_money_valuation_usd) }}
--------------------------------------------------------------------------------

FINAL RECOMMENDATION: {{ r.investment_decision.final_decision }}
Decision Score:  {{ r.investment_decision.decision_score }}/100
Check Size Tier: {{ r.investment_decision.suggested_check_size_tier }}

────────────────────────────────────────────────────────────────────────────────
SCORE DASHBOARD
────────────────────────────────────────────────────────────────────────────────
Financial Risk (Sustainability):   {{ r.financial_risk.sustainability_score }}/100
Market Momentum:                   {{ r.market_validation.market_momentum_score }}/100
Founder Intelligence:              {{ r.founder_intelligence.founder_intelligence_score }}/100
Portfolio Fit:                     {{ r.portfolio_fit.portfolio_fit_score }}/100
Competitive Opportunity:           {{ r.market_validation.competitive_saturation_score }}/100

────────────────────────────────────────────────────────────────────────────────
FINANCIAL ANALYSIS
────────────────────────────────────────────────────────────────────────────────
Runway:                     {{ r.financial_simulation.runway_months }} months (post-raise)
Burn Multiple:              {{ r.financial_simulation.burn_multiple }}x
Dilution (this round):      {{ r.financial_simulation.dilution_pct }}%
Bankruptcy Projection:      {{ r.financial_simulation.bankruptcy_projection_months }} months (no raise)
Capital Efficiency Ratio:   {{ r.financial_simulation.capital_efficiency_ratio }}
Valuation Realism Flag:     {{ "⚠️  FLAGGED" if r.financial_risk.valuation_realism_flag else "✓ OK" }}

Key Financial Risks:
{% for risk in r.financial_risk.key_financial_risks %}  • {{ risk }}
{% endfor %}

────────────────────────────────────────────────────────────────────────────────
MARKET VALIDATION
────────────────────────────────────────────────────────────────────────────────
TAM Claimed:                ${{ "{:,.0f}".format(r.startup.tam_usd_millions) }}M
Claimed Growth:             {{ r.startup.growth_rate_pct }}% YoY
Hype vs Evidence Delta:     {{ r.market_validation.hype_vs_evidence_delta }}

External Signals:
  Google Trends Score:      {{ r.market_signals.google_trends_score }}/100
  News Frequency Score:     {{ r.market_signals.news_frequency_score }}/100
  GitHub Activity Score:    {{ r.market_signals.github_activity_score }}/100
  Composite Signal:         {{ r.market_signals.composite_signal_score }}/100

Key Market Risks:
{% for risk in r.market_validation.key_market_risks %}  • {{ risk }}
{% endfor %}

────────────────────────────────────────────────────────────────────────────────
FOUNDER ASSESSMENT
────────────────────────────────────────────────────────────────────────────────
Founder Intelligence Score: {{ r.founder_intelligence.founder_intelligence_score }}/100
  Domain Fit:               {{ r.founder_intelligence.domain_fit_score }}/100
  Network Strength:         {{ r.founder_intelligence.network_strength_score }}/100
  Execution Credibility:    {{ r.founder_intelligence.execution_credibility_score }}/100
Risk Level:                 {{ r.founder_intelligence.risk_level }}

Key Founder Risks:
{% for risk in r.founder_intelligence.key_founder_risks %}  • {{ risk }}
{% endfor %}

────────────────────────────────────────────────────────────────────────────────
PORTFOLIO FIT
────────────────────────────────────────────────────────────────────────────────
Portfolio Fit Score:        {{ r.portfolio_fit.portfolio_fit_score }}/100
Overexposure Flag:          {{ "⚠️  YES" if r.portfolio_fit.overexposure_flag else "✓ NO" }}

────────────────────────────────────────────────────────────────────────────────
AGGREGATE KEY RISKS
────────────────────────────────────────────────────────────────────────────────
{% for risk in r.investment_decision.key_risks %}  {{ loop.index }}. {{ risk }}
{% endfor %}

────────────────────────────────────────────────────────────────────────────────
REQUIRED MILESTONES (if investing)
────────────────────────────────────────────────────────────────────────────────
{% for milestone in r.investment_decision.required_milestones %}  {{ loop.index }}. {{ milestone }}
{% endfor %}

================================================================================
END OF MEMO
================================================================================
""".strip()


def generate_memo(result: DueDiligenceResult) -> str:
    """Render a structured investment memo from the full due diligence result.

    Args:
        result: Complete DueDiligenceResult with all agent outputs.

    Returns:
        str: Rendered plain-text investment memo.
    """
    template = Template(_MEMO_TEMPLATE)
    return template.render(r=result)
