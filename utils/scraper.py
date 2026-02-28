import os
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# Config
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
COLLECTION_NAME = os.getenv("COLLECTION_NAME")
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
RAPIDAPI_HOST = os.getenv("RAPIDAPI_HOST")

def extract_username(url):
    """Turns https://www.linkedin.com/in/williamhgates/ into williamhgates"""
    return url.split('/in/')[-1].strip('/')

def main():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    # 1. Get pending leads
    leads = list(collection.find({"status": "pending"}).limit(5))
    
    if not leads:
        print("✅ No pending leads found.")
        return

    headers = {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST
    }

    for lead in leads:
        url = lead["linkedin_url"]
        username = extract_username(url)
        print(f"🚀 Scraping: {username}...")

        # 2. Call RapidAPI
        api_url = f"https://{RAPIDAPI_HOST}/api/v1/user/profile"
        querystring = {"username": username}

        try:
            response = requests.get(api_url, headers=headers, params=querystring)
            data = response.json()

            if response.status_code == 200:
                # 3. Update MongoDB with the full data
                collection.update_one(
                    {"_id": lead["_id"]},
                    {
                        "$set": {
                            "scraped_data": data,
                            "status": "scraped"
                        }
                    }
                )
                print(f"✅ Successfully saved data for {username}")
            else:
                print(f"❌ Error for {username}: {data.get('message', 'Unknown error')}")

        except Exception as e:
            print(f"⚠️ Failed to process {username}: {e}")

    print("\n🎉 All done! Check MongoDB Compass to see the results.")

if __name__ == "__main__":
    main()