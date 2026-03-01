"""
Shared Pydantic models for all inputs and outputs across the system.
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
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


# ─── LinkedIn Scraped Data ────────────────────────────────────────────────────

class LinkedInLocation(BaseModel):
    """Location data from LinkedIn profile."""
    country: Optional[str] = None
    country_code: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None


class LinkedInProfile(BaseModel):
    """Structured data extracted from LinkedIn via scraper."""
    full_name: str
    headline: Optional[str] = None
    public_identifier: Optional[str] = None
    is_premium: bool = False
    is_open_to_work: bool = False
    is_hiring: bool = False
    is_influencer: bool = False
    is_top_voice: bool = False
    is_creator: bool = False
    created_date: Optional[str] = None          # ISO date string
    location: Optional[LinkedInLocation] = None

    @property
    def linkedin_tenure_years(self) -> Optional[float]:
        """Calculate years since LinkedIn account creation."""
        if not self.created_date:
            return None
        try:
            created = datetime.fromisoformat(self.created_date.replace("Z", "+00:00"))
            now = datetime.now(created.tzinfo)
            return round((now - created).days / 365.25, 1)
        except (ValueError, TypeError):
            return None


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
    growth_rate_pct: Optional[float] = None          # claimed YoY growth %
    market_problem: str
    competitive_advantages: list[str]
    competitors: list[str]

    # Financials
    revenue_usd: float              # current ARR/MRR annualised
    burn_rate_usd_monthly: Optional[float] = None
    raise_amount_usd: float
    pre_money_valuation_usd: Optional[float] = None
    existing_cash_usd: Optional[float] = None

    # Founder
    founder_name: str = "Unknown"
    founder_background: str = ""         # raw text from profile
    prior_exits: int = 0
    domain_years_experience: int = 0
    notable_investors_or_advisors: list[str] = Field(default_factory=list)
    linkedin_connections_estimate: Optional[int] = None
    linkedin_profile: Optional[LinkedInProfile] = None


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
    runway_months: Optional[float]
    burn_multiple: Optional[float]
    dilution_pct: float
    bankruptcy_projection_months: Optional[float]
    capital_efficiency_ratio: float


# ─── Market Signal Outputs ────────────────────────────────────────────────────

class MarketSignals(BaseModel):
    google_trends_score: float      # 0-100
    news_frequency_score: float     # 0-100
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
    investment_decision: InvestmentDecisionOutput
    memo: str
