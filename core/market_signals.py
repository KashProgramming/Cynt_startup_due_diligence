"""
Market Signal Connector — fetches external signals from Google Trends, News API, GitHub.
Includes rate-limit handling and cached fallback mode.
All outputs are normalized numeric scores (0–100).
"""
import os
import math
import time
import logging
from functools import lru_cache
import os
from dotenv import load_dotenv

load_dotenv()

NEWS_API_KEY = os.getenv("NEWS_API_KEY")

if not NEWS_API_KEY:
    raise ValueError("NEWS_API_KEY not loaded")

logger = logging.getLogger(__name__)

_FALLBACK_SCORE = 50.0  # neutral fallback when APIs are unavailable


# ─── Google Trends ────────────────────────────────────────────────────────────

@lru_cache(maxsize=128)
def _get_trends_score_cached(keyword: str) -> float:
    """Cached Google Trends interest score for a keyword.

    Args:
        keyword: Search keyword (e.g. sector name).

    Returns:
        float: Score 0–100.
    """
    try:
        from pytrends.request import TrendReq
        pytrends = TrendReq(hl="en-US", tz=360, timeout=(10, 25))
        pytrends.build_payload([keyword], timeframe="today 12-m")
        data = pytrends.interest_over_time()
        if data.empty:
            return _FALLBACK_SCORE
        return float(data[keyword].mean())
    except Exception as e:
        logger.warning(f"Google Trends fallback for '{keyword}': {e}")
        return _FALLBACK_SCORE


# ─── News API ─────────────────────────────────────────────────────────────────

@lru_cache(maxsize=128)
def _get_news_score_cached(keyword: str) -> float:
    """Cached news frequency score for a keyword (last 30 days).

    Args:
        keyword: Topic keyword.

    Returns:
        float: Score 0–100 (normalised article count).
    """
    api_key = os.getenv("NEWS_API_KEY")
    if not api_key:
        logger.warning("NEWS_API_KEY not set; using fallback.")
        return _FALLBACK_SCORE
    try:
        from newsapi import NewsApiClient
        client = NewsApiClient(api_key=api_key)
        result = client.get_everything(q=keyword, language="en", page_size=1)
        total = result.get("totalResults", 0)
        # Normalize: cap at 10,000 articles → 100
        return min(math.log(total + 1) * 10, 100)
    except Exception as e:
        logger.warning(f"News API fallback for '{keyword}': {e}")
        return _FALLBACK_SCORE



# ─── Public interface ─────────────────────────────────────────────────────────

def fetch_market_signals(sector: str, competitors: list[str]) -> dict:
    """Fetch all market signals for a sector, returning normalized scores.

    Args:
        sector: The startup's sector/industry keyword.
        competitors: List of competitor names for additional signal context.

    Returns:
        dict: Raw signal scores before model construction.
    """
    keyword = sector.lower().strip()

    trends_score = _get_trends_score_cached(keyword)
    time.sleep(0.5)  # rate limit buffer between API calls

    news_score = _get_news_score_cached(keyword)

    composite = round(
        0.50 * trends_score + 0.50 * news_score, 2
    )

    return {
        "google_trends_score": round(trends_score, 2),
        "news_frequency_score": round(news_score, 2),
        "composite_signal_score": composite,
    }