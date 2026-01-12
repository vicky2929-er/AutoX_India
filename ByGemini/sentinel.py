import feedparser
import re
import datetime
import os
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne
from playwright.sync_api import sync_playwright

# Load environment variables (Security Best Practice)
load_dotenv()

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================

RSS_FEEDS = [
    "https://news.google.com/rss/search?q=India+Politics&hl=en-IN&gl=IN&ceid=IN:en",
    "https://economictimes.indiatimes.com/rssfeeds/Politics.xml",
    "https://news.google.com/rss/search?q=Ram+Mandir+OR+Ayodhya&hl=en-IN&gl=IN&ceid=IN:en",
    "https://news.google.com/rss/search?q=Hindu+festival&hl=en-IN&gl=IN&ceid=IN:en",
    "https://news.google.com/rss/search?q=India+Foreign+Policy&hl=en-IN&gl=IN&ceid=IN:en"
]

TAGS = {
    "Hindu / Culture": ["ram", "mandir", "diwali", "sanatan", "temple", "ayodhya", "culture", "dharma"],
    "Indian Politics": ["modi", "bjp", "congress", "parliament", "election", "government", "cabinet"],
    "Global / India": ["pakistan", "china", "usa", "ukraine", "israel", "russia", "geopolitics"],
    "Humanity / Social": ["help", "rescue", "donation", "relief", "save", "crisis"]
}

# ==========================================
# 🗄️ MONGODB CONNECTION
# ==========================================

def get_mongo_collection():
    uri = os.getenv("MONGO_URI")
    if not uri:
        raise ValueError("❌ MONGO_URI not found in .env file")
    
    try:
        client = MongoClient(uri)
        # Send a ping to confirm a successful connection
        client.admin.command('ping')
        print("   ✅ Connected to MongoDB Atlas")
        
        db = client["autox_india"]
        return db["raw_topics"]
    except Exception as e:
        print(f"   ❌ MongoDB Connection Error: {e}")
        return None

# ==========================================
# 🛠️ HELPER FUNCTIONS
# ==========================================

def clean_title(title):
    # Step 1 Part C: Normalize & Clean
    title = re.sub(r'\|.*$', '', title)
    title = re.sub(r'(LIVE|Watch|Video|Must Watch)', '', title, flags=re.IGNORECASE)
    return title.strip()

def derive_category(title):
    # Step 1 Part D: Keyword Tagging
    title_lower = title.lower()
    found_categories = []
    
    for category_name, keywords in TAGS.items():
        if any(keyword in title_lower for keyword in keywords):
            found_categories.append(category_name)
            
    if not found_categories:
        return "General News"
    
    # Return as a string "Cat1 / Cat2" as per your JSON spec
    return " / ".join(found_categories)

# ==========================================
# 📡 PART A: FETCH NEWS (RSS)
# ==========================================

def fetch_news_topics(collection):
    print("📡 Fetching RSS Feeds...")
    today = datetime.date.today().isoformat()
    operations = []
    
    for url in RSS_FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:5]:
                clean_t = clean_title(entry.title)
                category = derive_category(clean_t)
                
                # Prepare Upsert (Insert if new, Update if exists)
                doc = {
                    "title": clean_t,
                    "category": category,
                    "source": feed.feed.get('title', 'Google News'),
                    "source_link": entry.link,
                    "x_trending": False,
                    "trend_rank": 0,
                    "collected_at": today
                }
                
                # UpdateOne with upsert=True prevents duplicates based on 'title'
                operations.append(
                    UpdateOne({"title": clean_t}, {"$set": doc}, upsert=True)
                )
                print(f"   🔹 [News] {clean_t[:40]}...")
                
        except Exception as e:
            print(f"   ❌ Error fetching feed: {e}")

    if operations:
        result = collection.bulk_write(operations)
        print(f"   💾 Bulk Write: {result.upserted_count} new, {result.modified_count} updated.")

# ==========================================
# 📈 PART B: FETCH TRENDS (Playwright)
# ==========================================

def fetch_x_trends(collection):
    print("📈 Fetching X Trends...")
    today = datetime.date.today().isoformat()
    operations = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            page.goto("https://trends24.in/india/", timeout=60000)
            trends = page.locator('.trend-card').first.locator('li a').all()
            
            rank = 1
            for trend in trends[:10]:
                raw_title = trend.text_content()
                link = trend.get_attribute('href')
                clean_t = clean_title(raw_title)
                category = derive_category(clean_t)
                
                doc = {
                    "title": clean_t,
                    "category": category,
                    "source": "X Trends India",
                    "source_link": link,
                    "x_trending": True,
                    "trend_rank": rank,
                    "collected_at": today
                }
                
                operations.append(
                    UpdateOne({"title": clean_t}, {"$set": doc}, upsert=True)
                )
                print(f"   🔹 [Trend #{rank}] {clean_t}")
                rank += 1
                
        except Exception as e:
            print(f"   ❌ Error fetching trends: {e}")
        finally:
            browser.close()

    if operations:
        result = collection.bulk_write(operations)
        print(f"   💾 Bulk Write: {result.upserted_count} new, {result.modified_count} updated.")

# ==========================================
# 🚀 MAIN EXECUTION
# ==========================================

if __name__ == "__main__":
    print("--- 🔄 Step 1: Sentinel Started (MongoDB Atlas) ---")
    
    # 1. Connect to MongoDB
    collection = get_mongo_collection()
    
    if collection is not None:
        # 2. Fetch & Save
        fetch_news_topics(collection)
        fetch_x_trends(collection)
        print("--- ✅ Collection Complete. Data synced to Cloud. ---")