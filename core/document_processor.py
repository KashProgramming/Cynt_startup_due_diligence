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


def _safe_float(val) -> float | None:
    """Convert a value to float, returning None if empty/invalid."""
    if val is None:
        return None
    try:
        s = str(val).strip()
        if s == "" or s.lower() in ("nan", "none", "n/a", "-"):
            return None
        return float(s.replace(",", ""))
    except (ValueError, TypeError):
        return None


def parse_financial_csv(file_bytes: bytes, filename: str) -> dict:
    """Deterministically extract financial fields from the standard CSV format:

        Metric,Current,Projected
        Annual Revenue,150000,600000
        Monthly Burn Rate,25000,45000
        Existing Cash on Hand,60000,
        Target Raise Amount,1000000,
        Pre-Money Valuation,6000000,
        Annual Growth Rate,120,300
        TAM,2500,5000

    Returns a dict with keys matching StartupProfile financial fields.
    Only includes keys whose values were successfully parsed (non-null).
    Uses 'Current' column as the primary value; 'Projected' is used for
    growth rate and TAM when available.
    """
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes))
        else:
            df = pd.read_excel(io.BytesIO(file_bytes))
    except Exception as e:
        print(f"⚠️  Could not parse financial file: {e}")
        return {}

    # Normalize column names for robustness
    df.columns = [str(c).strip().lower() for c in df.columns]

    # We need at least a 'metric' and 'current' column
    if "metric" not in df.columns or "current" not in df.columns:
        print("⚠️  Financial CSV missing 'Metric' or 'Current' columns — skipping deterministic parse")
        return {}

    # Build row-lookup dicts: normalized metric name -> value
    lookup: dict[str, float | None] = {}
    projected_lookup: dict[str, float | None] = {}

    for _, row in df.iterrows():
        metric_raw = str(row.get("metric", "")).strip().lower()
        if not metric_raw or metric_raw == "nan":
            continue
        lookup[metric_raw] = _safe_float(row.get("current"))
        if "projected" in df.columns:
            projected_lookup[metric_raw] = _safe_float(row.get("projected"))

    result: dict = {}

    # Annual Revenue → revenue_usd (use Current)
    for key in ("annual revenue", "revenue", "arr", "annual revenue (usd)", "annual arr"):
        if key in lookup and lookup[key] is not None:
            result["revenue_usd"] = lookup[key]
            break

    # Monthly Burn Rate → burn_rate_usd_monthly (use Current)
    for key in ("monthly burn rate", "burn rate", "monthly burn", "burn rate (monthly)", "burn"):
        if key in lookup and lookup[key] is not None:
            result["burn_rate_usd_monthly"] = lookup[key]
            break

    # Existing Cash on Hand → existing_cash_usd (use Current)
    for key in ("existing cash on hand", "cash on hand", "existing cash", "cash"):
        if key in lookup and lookup[key] is not None:
            result["existing_cash_usd"] = lookup[key]
            break

    # Target Raise Amount → raise_amount_usd (use Current)
    for key in ("target raise amount", "raise amount", "target raise", "raise", "funding ask"):
        if key in lookup and lookup[key] is not None:
            result["raise_amount_usd"] = lookup[key]
            break

    # Pre-Money Valuation → pre_money_valuation_usd (use Current)
    for key in ("pre-money valuation", "pre money valuation", "pre-money val", "valuation"):
        if key in lookup and lookup[key] is not None:
            result["pre_money_valuation_usd"] = lookup[key]
            break

    # Annual Growth Rate → growth_rate_pct
    # Prefer Projected value (the target growth rate) over Current
    for key in ("annual growth rate", "growth rate", "yoy growth", "growth"):
        projected_val = projected_lookup.get(key)
        current_val = lookup.get(key)
        val = projected_val if projected_val is not None else current_val
        if val is not None:
            result["growth_rate_pct"] = val
            break

    # TAM → tam_usd_millions
    # Prefer Projected TAM (future market size) over Current
    for key in ("tam", "total addressable market", "market size"):
        projected_val = projected_lookup.get(key)
        current_val = lookup.get(key)
        val = projected_val if projected_val is not None else current_val
        if val is not None:
            result["tam_usd_millions"] = val
            break

    return result


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

    Financial fields are extracted deterministically from the CSV first,
    then all other fields are extracted via LLM from pitch deck + founder profile.
    Deterministic CSV values always override LLM estimates for financial fields.

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

    # ── Step 1: Deterministic financial extraction from CSV ────────────────
    csv_financials = parse_financial_csv(financial_bytes, financial_filename)
    print(f"📊 CSV financials extracted: {csv_financials}")

    # ── Step 2: LLM extraction for all fields ─────────────────────────────
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

    # ── Clean up nulls for required non-optional fields ─
    data["founder_name"] = data.get("founder_name") or "Unknown"
    data["founder_background"] = data.get("founder_background") or ""
    data["prior_exits"] = data.get("prior_exits") or 0
    data["domain_years_experience"] = data.get("domain_years_experience") or 0
    data["notable_investors_or_advisors"] = data.get("notable_investors_or_advisors") or []

    # ── Step 3: Override LLM financial fields with deterministic CSV values ─
    # Only override if the CSV actually provided a value (non-None)
    for field, value in csv_financials.items():
        if value is not None:
            data[field] = value
            print(f"  ✅ {field} = {value} (from CSV, overrides LLM)")

    profile = StartupProfile(**data)

    # ── Step 4: Enrich with LinkedIn scraped data if available ─────────────
    linkedin_url = _find_linkedin_url(founder_text, deck_text)
    if linkedin_url:
        linkedin_profile = fetch_linkedin_profile(linkedin_url)
        if linkedin_profile:
            profile.linkedin_profile = linkedin_profile
            print(f"✅ Enriched profile with LinkedIn data for {linkedin_profile.full_name}")

    return profile
