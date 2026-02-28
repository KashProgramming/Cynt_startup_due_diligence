"""
LinkedIn Scraper — calls RapidAPI to scrape a LinkedIn profile and
stores the result in MongoDB's 'indicator' collection so that
linkedin_fetcher.py can pick it up during pipeline analysis.
"""
import os
import requests
from dotenv import load_dotenv
from utils.db import get_indicator_collection

load_dotenv()

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
RAPIDAPI_HOST = os.getenv("RAPIDAPI_HOST")


def extract_username(url: str) -> str:
    """Extract LinkedIn username from a profile URL."""
    return url.rstrip("/").split("/in/")[-1].strip("/")


def scrape_and_store_linkedin(linkedin_url: str) -> bool:
    """Scrape a LinkedIn profile via RapidAPI and upsert into MongoDB.

    Args:
        linkedin_url: Full LinkedIn profile URL (e.g. https://linkedin.com/in/username).

    Returns:
        True if scrape was successful and stored, False otherwise.
    """
    if not RAPIDAPI_KEY or not RAPIDAPI_HOST:
        print("⚠️ LinkedIn scraping skipped: RAPIDAPI_KEY or RAPIDAPI_HOST not set")
        return False

    username = extract_username(linkedin_url)
    if not username:
        return False

    headers = {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
    }
    api_url = f"https://{RAPIDAPI_HOST}/api/v1/user/profile"
    params = {"username": username}

    try:
        response = requests.get(api_url, headers=headers, params=params, timeout=15)
        data = response.json()

        if response.status_code == 200:
            collection = get_indicator_collection()
            # Upsert: update if URL exists, insert if not
            collection.update_one(
                {"linkedin_url": linkedin_url},
                {
                    "$set": {
                        "name": data.get("data", {}).get("full_name", username),
                        "linkedin_url": linkedin_url,
                        "scraped_data": data,
                        "status": "scraped",
                    }
                },
                upsert=True,
            )
            print(f"✅ LinkedIn scraped & stored for {username}")
            return True
        else:
            print(f"❌ LinkedIn scrape failed for {username}: {data.get('message', 'Unknown error')}")
            return False

    except Exception as e:
        print(f"⚠️ LinkedIn scrape error for {username}: {e}")
        return False
