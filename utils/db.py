"""
MongoDB connection singleton.
Uses MONGO_URI from .env to connect. Provides get_db() accessor.
"""
import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

_client = None
_db = None

DB_NAME = "due_diligence"


def get_db():
    """Return the MongoDB database instance (lazy singleton)."""
    global _client, _db
    if _db is None:
        uri = os.getenv("MONGO_URI")
        if not uri:
            raise RuntimeError("MONGO_URI not set in environment")
        _client = MongoClient(uri)
        _db = _client[DB_NAME]
    return _db


def get_users_collection():
    return get_db()["users"]


def get_applications_collection():
    return get_db()["applications"]


def get_collaborations_collection():
    return get_db()["collaborations"]


def get_indicator_collection():
    """Return the 'indicator' collection in the data DB (same one used by scraper.py / linkedin_fetcher.py)."""
    global _client
    if _client is None:
        uri = os.getenv("MONGO_URI")
        if not uri:
            raise RuntimeError("MONGO_URI not set in environment")
        _client = MongoClient(uri)
    db_name = os.getenv("DB_NAME", "data")
    col_name = os.getenv("COLLECTION_NAME", "indicator")
    return _client[db_name][col_name]
