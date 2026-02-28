"""
LinkedIn Data Fetcher — pulls scraped LinkedIn profile from MongoDB.
"""
import os
from typing import Optional

from pymongo import MongoClient
from dotenv import load_dotenv

from utils.models import LinkedInProfile, LinkedInLocation

load_dotenv()

_MONGO_URI = os.getenv("MONGO_URI")
_DB_NAME = os.getenv("DB_NAME")
_COLLECTION_NAME = os.getenv("COLLECTION_NAME")


def fetch_linkedin_profile(linkedin_url: str) -> Optional[LinkedInProfile]:
    """Fetch a scraped LinkedIn profile from MongoDB.

    Args:
        linkedin_url: The LinkedIn profile URL to look up.

    Returns:
        LinkedInProfile if found and successfully parsed, None otherwise.
    """
    if not all([_MONGO_URI, _DB_NAME, _COLLECTION_NAME]):
        return None

    try:
        client = MongoClient(_MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client[_DB_NAME]
        collection = db[_COLLECTION_NAME]

        doc = collection.find_one({
            "linkedin_url": linkedin_url,
            "status": "scraped",
        })

        if not doc or "scraped_data" not in doc:
            return None

        scraped = doc["scraped_data"]
        if not scraped.get("success") or "data" not in scraped:
            return None

        data = scraped["data"]

        # Map location
        loc_data = data.get("location")
        location = LinkedInLocation(**loc_data) if loc_data else None

        return LinkedInProfile(
            full_name=data.get("full_name", ""),
            headline=data.get("headline"),
            public_identifier=data.get("public_identifier"),
            is_premium=data.get("is_premium", False),
            is_open_to_work=data.get("is_open_to_work", False),
            is_hiring=data.get("is_hiring", False),
            is_influencer=data.get("is_influencer", False),
            is_top_voice=data.get("is_top_voice", False),
            is_creator=data.get("is_creator", False),
            created_date=data.get("created_date"),
            location=location,
        )

    except Exception as e:
        print(f"⚠️ LinkedIn fetch failed: {e}")
        return None
