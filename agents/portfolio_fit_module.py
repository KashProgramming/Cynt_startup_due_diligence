"""
Portfolio Fit Module — fully deterministic evaluation of startup fit against
investor's existing portfolio. No LLM.
"""
from utils.models import StartupProfile, InvestorPortfolio, PortfolioFitOutput


def _sector_overlap_score(sector: str, portfolio_sectors: list[str]) -> float:
    """Score sector overlap. Higher overlap = lower fit score.

    Args:
        sector: Startup sector.
        portfolio_sectors: Sectors already in portfolio.

    Returns:
        float: Contribution score 0–100.
    """
    sector_lower = sector.lower()
    matches = sum(1 for s in portfolio_sectors if s.lower() == sector_lower)
    concentration_pct = (matches / max(len(portfolio_sectors), 1)) * 100
    # Invert: less overlap = better fit
    return max(0.0, 100.0 - concentration_pct * 2)


def _stage_fit_score(stage: str, portfolio_stages: list[str]) -> float:
    """Score stage alignment.

    Args:
        stage: Startup stage.
        portfolio_stages: Stages investor typically invests in.

    Returns:
        float: 100 if match, 40 if partial, 0 if mismatch.
    """
    stage_lower = stage.lower()
    for s in portfolio_stages:
        if s.lower() in stage_lower or stage_lower in s.lower():
            return 100.0
    return 40.0  # investor may stretch


def _geo_alignment_score(geography: str, portfolio_geos: list[str]) -> float:
    """Score geographic alignment.

    Args:
        geography: Startup geography.
        portfolio_geos: Investor's target geographies.

    Returns:
        float: 100 if match, 60 if not.
    """
    geo_lower = geography.lower()
    for g in portfolio_geos:
        if g.lower() in geo_lower or geo_lower in g.lower():
            return 100.0
    return 60.0  # geo mismatch is a soft flag


def _check_size_fit_score(
    raise_amount: float,
    check_range: tuple[float, float],
) -> float:
    """Score whether the raise amount aligns with investor check size.

    Args:
        raise_amount: Amount startup is raising in USD.
        check_range: Investor's (min, max) check size in USD.

    Returns:
        float: 100 if within range, scaled down if outside.
    """
    min_check, max_check = check_range
    if min_check <= raise_amount <= max_check:
        return 100.0
    if raise_amount < min_check:
        ratio = raise_amount / min_check
        return max(0.0, ratio * 80.0)
    # raise_amount > max_check
    ratio = max_check / raise_amount
    return max(0.0, ratio * 80.0)


def _overexposure_flag(
    sector: str,
    portfolio_sectors: list[str],
    max_concentration_pct: float,
    total_investments: int,
) -> bool:
    """Determine if adding this startup would breach concentration limit.

    Args:
        sector: Startup sector.
        portfolio_sectors: All portfolio sectors.
        max_concentration_pct: Maximum allowed sector concentration %.
        total_investments: Total current portfolio size.

    Returns:
        bool: True if adding this deal would breach concentration limit.
    """
    sector_lower = sector.lower()
    current_in_sector = sum(1 for s in portfolio_sectors if s.lower() == sector_lower)
    new_total = total_investments + 1
    new_concentration = ((current_in_sector + 1) / new_total) * 100
    return new_concentration > max_concentration_pct


def run_portfolio_fit_module(
    startup: StartupProfile,
    portfolio: InvestorPortfolio,
) -> PortfolioFitOutput:
    """Run the deterministic Portfolio Fit Module.

    Args:
        startup: Extracted startup profile.
        portfolio: Investor's current portfolio context.

    Returns:
        PortfolioFitOutput: Portfolio fit score and overexposure flag.
    """
    sector_score = _sector_overlap_score(startup.sector, portfolio.portfolio_sectors)
    stage_score = _stage_fit_score(startup.stage, portfolio.portfolio_stages)
    geo_score = _geo_alignment_score(startup.geography, portfolio.portfolio_geographies)
    check_score = _check_size_fit_score(
        startup.raise_amount_usd, portfolio.check_size_range_usd
    )

    # Weighted composite: stage and check size matter most
    portfolio_fit_score = int(
        0.25 * sector_score
        + 0.30 * stage_score
        + 0.20 * geo_score
        + 0.25 * check_score
    )

    overexposure = _overexposure_flag(
        startup.sector,
        portfolio.portfolio_sectors,
        portfolio.target_max_sector_concentration_pct,
        portfolio.total_investments,
    )

    return PortfolioFitOutput(
        portfolio_fit_score=min(max(portfolio_fit_score, 0), 100),
        overexposure_flag=overexposure,
    )
