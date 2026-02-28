"""
Founder Intelligence Agent — rubric-based scoring of domain fit, network strength,
and execution credibility.
"""
from langchain_core.messages import HumanMessage, SystemMessage

from utils.llm import get_llm, extract_json
from utils.models import StartupProfile, FounderIntelligenceOutput

_SYSTEM = """You are a startup founder evaluation specialist.
Score 0–100 per dimension using the rubric. 100 = best possible.
Respond ONLY with valid JSON, no explanation outside the JSON."""

_PROMPT = """Founder: {founder_name}
Company: {company} | Sector: {sector} | Stage: {stage}

Founder Profile:
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


def run_founder_intelligence_agent(startup: StartupProfile) -> FounderIntelligenceOutput:
    """Run the Founder Intelligence Agent.

    Args:
        startup: Extracted startup profile with founder fields.

    Returns:
        FounderIntelligenceOutput: Structured founder intelligence assessment.
    """
    prompt = _PROMPT.format(
        founder_name=startup.founder_name,
        company=startup.company_name,
        sector=startup.sector,
        stage=startup.stage,
        background=startup.founder_background[:2000],
        exits=startup.prior_exits,
        domain_years=startup.domain_years_experience,
        advisors=", ".join(startup.notable_investors_or_advisors) or "None listed",
        connections=startup.linkedin_connections_estimate or "Unknown",
    )

    llm = get_llm()
    response = llm.invoke([
        SystemMessage(content=_SYSTEM),
        HumanMessage(content=prompt),
    ])
    data = extract_json(response.content)
    return FounderIntelligenceOutput(**data)
