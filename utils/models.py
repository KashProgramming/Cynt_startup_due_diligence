"""
Shared Pydantic models for all inputs and outputs across the system.
"""
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


# ─── Enums ───────────────────────────────────────────────────────────────────

class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class InvestorType(str, Enum):
    ANGEL = "ANGEL"
    EARLY_VC = "EARLY_VC"
    ACCELERATOR = "ACCELERATOR"
    COMMITTEE = "COMMITTEE"

class FinalDecision(str, Enum):
    INVEST = "INVEST"
    INVEST_WITH_CONDITIONS = "INVEST_WITH_CONDITIONS"
    WATCHLIST = "WATCHLIST"
    PASS = "PASS"

class CheckSizeTier(str, Enum):
    SMALL = "SMALL"
    MEDIUM = "MEDIUM"
    LARGE = "LARGE"


# ─── Extracted Document Data ──────────────────────────────────────────────────

class StartupProfile(BaseModel):
    """Structured data extracted from pitch deck and founder profile."""
    # Company basics
    company_name: str
    sector: str
    stage: str  # e.g. pre-seed, seed, Series A
    geography: str

    # Market claims
    tam_usd_millions: float
    growth_rate_pct: float          # claimed YoY growth %
    market_problem: str
    competitive_advantages: list[str]
    competitors: list[str]

    # Financials
    revenue_usd: float              # current ARR/MRR annualised
    burn_rate_usd_monthly: float
    raise_amount_usd: float
    pre_money_valuation_usd: float
    existing_cash_usd: Optional[float] = None

    # Founder
    founder_name: str
    founder_background: str         # raw text from profile
    prior_exits: int
    domain_years_experience: int
    notable_investors_or_advisors: list[str]
    linkedin_connections_estimate: Optional[int] = None


class InvestorPortfolio(BaseModel):
    """Current investor portfolio context for fit analysis."""
    investor_type: InvestorType
    portfolio_sectors: list[str]
    portfolio_stages: list[str]
    portfolio_geographies: list[str]
    check_size_range_usd: tuple[float, float]   # (min, max)
    total_investments: int
    target_max_sector_concentration_pct: float = 30.0


# ─── Financial Simulation Outputs ────────────────────────────────────────────

class FinancialSimulationResult(BaseModel):
    runway_months: float
    burn_multiple: float
    dilution_pct: float
    bankruptcy_projection_months: float
    capital_efficiency_ratio: float


# ─── Market Signal Outputs ────────────────────────────────────────────────────

class MarketSignals(BaseModel):
    google_trends_score: float      # 0-100
    news_frequency_score: float     # 0-100
    github_activity_score: float    # 0-100 (for tech sectors)
    composite_signal_score: float   # 0-100 weighted average


# ─── Agent Outputs ────────────────────────────────────────────────────────────

class FinancialRiskOutput(BaseModel):
    sustainability_score: int = Field(ge=0, le=100)
    bankruptcy_timeline_months: int
    capital_efficiency_ratio: float
    valuation_realism_flag: bool
    key_financial_risks: list[str]


class MarketValidationOutput(BaseModel):
    market_momentum_score: int = Field(ge=0, le=100)
    hype_vs_evidence_delta: float   # positive = more hype than evidence
    competitive_saturation_score: int = Field(ge=0, le=100)
    key_market_risks: list[str]


class FounderIntelligenceOutput(BaseModel):
    founder_intelligence_score: int = Field(ge=0, le=100)
    domain_fit_score: int = Field(ge=0, le=100)
    network_strength_score: int = Field(ge=0, le=100)
    execution_credibility_score: int = Field(ge=0, le=100)
    risk_level: RiskLevel
    key_founder_risks: list[str]


class PortfolioFitOutput(BaseModel):
    portfolio_fit_score: int = Field(ge=0, le=100)
    overexposure_flag: bool


class InvestmentDecisionOutput(BaseModel):
    final_decision: FinalDecision
    decision_score: float
    key_risks: list[str]
    required_milestones: list[str]
    suggested_check_size_tier: CheckSizeTier


# ─── Full Pipeline Result ─────────────────────────────────────────────────────

class DueDiligenceResult(BaseModel):
    startup: StartupProfile
    financial_simulation: FinancialSimulationResult
    market_signals: MarketSignals
    financial_risk: FinancialRiskOutput
    market_validation: MarketValidationOutput
    founder_intelligence: FounderIntelligenceOutput
    portfolio_fit: PortfolioFitOutput
    investment_decision: InvestmentDecisionOutput
    memo: str
