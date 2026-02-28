"""
Founder Intelligence Agent — rubric-based scoring of domain fit, network strength,
and execution credibility.  Uses real LinkedIn scraped data when available.
"""
from langchain_core.messages import HumanMessage, SystemMessage

from utils.llm import get_llm, extract_json
from utils.models import StartupProfile, FounderIntelligenceOutput

_SYSTEM = """You are a startup founder evaluation specialist.
Score 0–100 per dimension using the rubric. 100 = best possible.
Respond ONLY with valid JSON, no explanation outside the JSON."""

# ── Prompt when real LinkedIn data is available ──────────────────────────────

_PROMPT_WITH_LINKEDIN = """Founder: {founder_name}
Company: {company} | Sector: {sector} | Stage: {stage}

── LinkedIn Profile (verified scraped data) ──
Headline: {headline}
Location: {location}
LinkedIn Tenure: {tenure_years} years (account created {created_date})
Premium Account: {is_premium}
Open to Work: {is_open_to_work}
Currently Hiring: {is_hiring}
LinkedIn Influencer: {is_influencer}
Top Voice: {is_top_voice}
Content Creator: {is_creator}

── Supplementary Background (from pitch deck / founder profile) ──
{background}

Rubric:
A. Domain Fit (0–100):
   - Parse the headline for sector-relevant roles and companies
   - LinkedIn tenure as proxy for professional experience depth
   - Technical depth implied by headline keywords and background

B. Network Strength (0–100):
   - Premium account = stronger professional investment
   - Influencer / Top Voice / Creator status = significant reach
   - is_hiring = team-building capability
   - Location in a startup hub (SF, NYC, Bangalore, London, etc.) boosts score

C. Execution Credibility (0–100):
   - Headline shows progressive roles / leadership positions
   - is_hiring = actively building a team (positive signal)
   - is_open_to_work while founding = commitment risk (negative signal)
   - Background mentions prior exits, shipped products, traction

founder_intelligence_score = average of A, B, C
risk_level: LOW if score>=70, MEDIUM if 40–69, HIGH if <40

Return exactly:
{{
  "founder_intelligence_score": int,
  "domain_fit_score": int,
  "network_strength_score": int,
  "execution_credibility_score": int,
  "risk_level": "LOW|MEDIUM|HIGH",
  "key_founder_risks": [str, str, str]
}}"""

# ── Fallback prompt when no LinkedIn data is available ───────────────────────

_PROMPT_FALLBACK = """Founder: {founder_name}
Company: {company} | Sector: {sector} | Stage: {stage}

Founder Profile (from documents):
{background}

Quantitative signals:
- Prior exits: {exits}
- Domain experience: {domain_years} years
- Notable backers/advisors: {advisors}
- LinkedIn connections estimate: {connections}

Rubric:
A. Domain Fit (0–100): Years in sector, direct relevance, technical depth
B. Network Strength (0–100): Notable backers, advisors, LinkedIn reach, warm intros potential
C. Execution Credibility (0–100): Prior exits, shipped products, team-building evidence, traction proof

founder_intelligence_score = average of A, B, C
risk_level: LOW if score>=70, MEDIUM if 40–69, HIGH if <40

Return exactly:
{{
  "founder_intelligence_score": int,
  "domain_fit_score": int,
  "network_strength_score": int,
  "execution_credibility_score": int,
  "risk_level": "LOW|MEDIUM|HIGH",
  "key_founder_risks": [str, str, str]
}}"""


def _build_prompt_with_linkedin(startup: StartupProfile) -> str:
    """Build the prompt using real LinkedIn scraped data."""
    lp = startup.linkedin_profile

    location_str = "Unknown"
    if lp.location:
        parts = [p for p in [lp.location.city, lp.location.country] if p]
        location_str = ", ".join(parts) or "Unknown"

    return _PROMPT_WITH_LINKEDIN.format(
        founder_name=lp.full_name or startup.founder_name,
        company=startup.company_name,
        sector=startup.sector,
        stage=startup.stage,
        headline=lp.headline or "Not available",
        location=location_str,
        tenure_years=lp.linkedin_tenure_years or "Unknown",
        created_date=lp.created_date or "Unknown",
        is_premium="Yes" if lp.is_premium else "No",
        is_open_to_work="Yes" if lp.is_open_to_work else "No",
        is_hiring="Yes" if lp.is_hiring else "No",
        is_influencer="Yes" if lp.is_influencer else "No",
        is_top_voice="Yes" if lp.is_top_voice else "No",
        is_creator="Yes" if lp.is_creator else "No",
        background=startup.founder_background[:2000] if startup.founder_background else "None provided",
    )


def _build_prompt_fallback(startup: StartupProfile) -> str:
    """Build the fallback prompt using only document-extracted data."""
    return _PROMPT_FALLBACK.format(
        founder_name=startup.founder_name,
        company=startup.company_name,
        sector=startup.sector,
        stage=startup.stage,
        background=startup.founder_background[:2000] if startup.founder_background else "None provided",
        exits=startup.prior_exits,
        domain_years=startup.domain_years_experience,
        advisors=", ".join(startup.notable_investors_or_advisors) or "None listed",
        connections=startup.linkedin_connections_estimate or "Unknown",
    )


def run_founder_intelligence_agent(startup: StartupProfile) -> FounderIntelligenceOutput:
    """Run the Founder Intelligence Agent.

    Uses real LinkedIn scraped data when available on the startup profile,
    falling back to document-extracted fields otherwise.

    Args:
        startup: Extracted startup profile, optionally enriched with LinkedIn data.

    Returns:
        FounderIntelligenceOutput: Structured founder intelligence assessment.
    """
    if startup.linkedin_profile:
        prompt = _build_prompt_with_linkedin(startup)
    else:
        prompt = _build_prompt_fallback(startup)

    llm = get_llm()
    response = llm.invoke([
        SystemMessage(content=_SYSTEM),
        HumanMessage(content=prompt),
    ])
    data = extract_json(response.content)
    return FounderIntelligenceOutput(**data)
