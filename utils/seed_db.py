import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load secrets from the .env file
load_dotenv()

client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("DB_NAME")]
collection = db[os.getenv("COLLECTION_NAME")]

# Clean the collection for a fresh test
collection.delete_many({})

# Inject two test profiles
test_leads = [
    {"name": "Kashish Mandhane", "linkedin_url": "https://www.linkedin.com/in/kashishmandhane", "status": "pending"},
    {"name": "Mihir Mashruwala", "linkedin_url": "https://www.linkedin.com/in/mihir-mashruwala", "status": "pending"}
]

collection.insert_many(test_leads)
print("✅ Inserted test leads into MongoDB! You are ready to run the scraper.")