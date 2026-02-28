"""
Document Processing Module — parses PDFs, CSVs, XLSX and extracts structured startup data.
No reasoning logic; uses structured prompts for field extraction only.
"""
import json
import re
import io
from pathlib import Path
from langchain_core.messages import HumanMessage, SystemMessage

import pandas as pd
from pypdf import PdfReader

from utils.llm import get_llm, extract_json
from utils.models import StartupProfile
from utils.linkedin_fetcher import fetch_linkedin_profile


# ─── Raw text extraction ──────────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all text from a PDF file.

    Args:
        file_bytes: Raw PDF bytes.

    Returns:
        str: Concatenated text from all pages.
    """
    reader = PdfReader(io.BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def extract_text_from_financials(file_bytes: bytes, filename: str) -> str:
    """Parse CSV or XLSX financial sheet into a plain-text table string.

    Args:
        file_bytes: Raw file bytes.
        filename: Original filename (used to detect format).

    Returns:
        str: Stringified tabular data.
    """
    if filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(file_bytes))
    else:
        df = pd.read_excel(io.BytesIO(file_bytes))
    return df.to_string(index=False)


def _find_linkedin_url(*texts: str) -> str | None:
    """Search text blobs for a LinkedIn profile URL.

    Returns:
        The first LinkedIn profile URL found, or None.
    """
    pattern = r"https?://(?:www\.)?linkedin\.com/in/[A-Za-z0-9_-]+"
    for text in texts:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    return None


# ─── Field extraction via LLM ────────────────────────────────────────────────

_EXTRACTION_SYSTEM = """You are a startup data extraction assistant.
Extract structured fields from the provided documents.
Respond ONLY with a single valid JSON object matching the schema exactly.
Use null for missing numeric fields only if truly absent; otherwise estimate conservatively.
All monetary values must be in USD."""

_EXTRACTION_PROMPT = """Documents:
--- PITCH DECK ---
{deck_text}

--- FINANCIALS ---
{financial_text}

--- FOUNDER PROFILE ---
{founder_text}

Extract and return this exact JSON schema:
{{
  "company_name": str,
  "sector": str,
  "stage": str,
  "geography": str,
  "tam_usd_millions": float,
  "growth_rate_pct": float or null,
  "market_problem": str,
  "competitive_advantages": [str],
  "competitors": [str],
  "revenue_usd": float,
  "burn_rate_usd_monthly": float or null,
  "raise_amount_usd": float,
  "pre_money_valuation_usd": float or null,
  "existing_cash_usd": float,
  "founder_name": str,
  "founder_background": str,
  "prior_exits": int,
  "domain_years_experience": int,
  "notable_investors_or_advisors": [str],
  "linkedin_connections_estimate": int or null
}}"""


def extract_startup_profile(
    deck_bytes: bytes,
    financial_bytes: bytes,
    financial_filename: str,
    founder_bytes: bytes,
) -> StartupProfile:
    """Extract a structured StartupProfile from uploaded documents.

    After LLM extraction, automatically tries to enrich the profile with
    real LinkedIn scraped data from MongoDB if a LinkedIn URL is found.

    Args:
        deck_bytes: PDF pitch deck bytes.
        financial_bytes: CSV/XLSX financial sheet bytes.
        financial_filename: Financial file name (to detect format).
        founder_bytes: PDF/text founder profile bytes.

    Returns:
        StartupProfile: Validated structured startup data, optionally enriched.
    """
    deck_text = extract_text_from_pdf(deck_bytes)
    financial_text = extract_text_from_financials(financial_bytes, financial_filename)
    founder_text = extract_text_from_pdf(founder_bytes)

    llm = get_llm()
    prompt = _EXTRACTION_PROMPT.format(
        deck_text=deck_text[:6000],
        financial_text=financial_text[:3000],
        founder_text=founder_text[:3000],
    )
    response = llm.invoke([
        SystemMessage(content=_EXTRACTION_SYSTEM),
        HumanMessage(content=prompt),
    ])
    data = extract_json(response.content)
    profile = StartupProfile(**data)

    # ── Enrich with LinkedIn scraped data if available ─────────────────────
    linkedin_url = _find_linkedin_url(founder_text, deck_text)
    if linkedin_url:
        linkedin_profile = fetch_linkedin_profile(linkedin_url)
        if linkedin_profile:
            profile.linkedin_profile = linkedin_profile
            print(f"✅ Enriched profile with LinkedIn data for {linkedin_profile.full_name}")

    return profile
