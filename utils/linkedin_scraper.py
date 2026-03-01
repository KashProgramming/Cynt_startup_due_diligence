"""
LinkedIn Scraper Utility — calls RapidAPI to fetch a live LinkedIn profile
and maps it to a SimpleNamespace matching the LinkedInProfile structure.

Used by the pipeline as a live-fallback when MongoDB has no pre-scraped data.

Also re-exports scrape_and_store_linkedin from linkedin_scrappper so that
api/gateway.py can import everything from one place.
"""
import os
import logging
import requests
from types import SimpleNamespace
from dotenv import load_dotenv

# Re-export so gateway.py's `from utils.linkedin_scraper import scrape_and_store_linkedin` works
from utils.linkedin_scrappper import scrape_and_store_linkedin  # noqa: F401

load_dotenv()

logger = logging.getLogger(__name__)


def _get_api_key() -> str:
    """Get RAPIDAPI_KEY from env; raise ValueError if missing."""
    key = os.getenv("RAPIDAPI_KEY")
    if not key:
        raise ValueError("RAPIDAPI_KEY not found in environment. Set it in .env")
    return key


def _get_api_host() -> str:
    """Get RAPIDAPI_HOST from env with a sensible default."""
    return os.getenv(
        "RAPIDAPI_HOST",
        "fresh-linkedin-scraper-api.p.rapidapi.com",
    )


def extract_username(linkedin_url: str) -> str:
    """Extract LinkedIn username from a full profile URL.

    Args:
        linkedin_url: e.g. https://www.linkedin.com/in/johndoe/

    Returns:
        str: Username portion, e.g. 'johndoe'.
    """
    return linkedin_url.rstrip("/").split("/in/")[-1].strip("/")


def fetch_linkedin_profile(username: str) -> dict:
    """Call RapidAPI to fetch a LinkedIn profile by username.

    Args:
        username: LinkedIn username (slug), e.g. 'johndoe'.

    Returns:
        dict: Raw API response JSON.

    Raises:
        ValueError: If RAPIDAPI_KEY is not set.
        Exception: If the API call fails or returns a non-200 status.
    """
    api_key = _get_api_key()
    host = _get_api_host()

    headers = {
        "x-rapidapi-key": api_key,
        "x-rapidapi-host": host,
    }
    url = f"https://{host}/api/v1/user/profile"
    response = requests.get(url, headers=headers, params={"username": username}, timeout=15)

    if response.status_code != 200:
        raise Exception(
            f"LinkedIn API error {response.status_code}: {response.text[:300]}"
        )

    return response.json()


def map_linkedin_to_profile(raw: dict) -> SimpleNamespace:
    """Map raw RapidAPI response to a SimpleNamespace matching LinkedInProfile fields.

    Args:
        raw: JSON dict returned by fetch_linkedin_profile().

    Returns:
        SimpleNamespace with attributes:
            full_name, headline, location (city/country), is_premium,
            is_open_to_work, is_hiring, is_influencer, is_top_voice,
            is_creator, linkedin_tenure_years, created_date.
    """
    data = raw.get("data", raw)  # some APIs wrap under 'data', some don't

    loc_raw = data.get("location") or {}
    location = SimpleNamespace(
        city=loc_raw.get("city") if isinstance(loc_raw, dict) else None,
        country=loc_raw.get("country") if isinstance(loc_raw, dict) else None,
    )

    return SimpleNamespace(
        full_name=data.get("full_name") or data.get("fullName"),
        headline=data.get("headline"),
        location=location,
        is_premium=bool(data.get("is_premium") or data.get("premium", False)),
        is_open_to_work=bool(data.get("is_open_to_work") or data.get("openToWork", False)),
        is_hiring=bool(data.get("is_hiring") or data.get("isHiring", False)),
        is_influencer=bool(data.get("is_influencer") or data.get("influencer", False)),
        is_top_voice=bool(data.get("is_top_voice") or data.get("topVoice", False)),
        is_creator=bool(data.get("is_creator") or data.get("creator", False)),
        linkedin_tenure_years=data.get("tenureYears"),
        created_date=data.get("created_date") or data.get("createdDate"),
    )