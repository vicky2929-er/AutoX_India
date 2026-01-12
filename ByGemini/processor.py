import os
import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

# Load Environment Variables
load_dotenv()

# ==========================================
# ⚙️ CONFIGURATION & RULES
# ==========================================

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "autox_india"

# 🚫 Blocklist: Topics to auto-reject (add more as needed)
BLOCKWORDS = [
    "celebrity gossip", "movie review", "trailer", "box office", 
    "sports score", "cricket match result", "big boss", "reality show",
    "dating", "fashion", "horoscope"
]

# ==========================================
# 🧮 SCORING ENGINE (Your Logic)
# ==========================================

def get_trend_score(doc):
    """
    PART A — X Trending Score (0–40)
    """
    if not doc.get('x_trending', False):
        return 0
    
    rank = doc.get('trend_rank', 99)
    
    if rank <= 3: return 40
    if rank <= 5: return 30
    return 20

def get_category_score(category_str):
    """
    PART B — Category Score (0–45)
    Parses the "Category / Category" string from Step 1
    """
    score = 0
    # Convert string to lowercase for checking
    cat_lower = category_str.lower()
    
    # Check keywords inside the category string
    if "politics" in cat_lower: score += 20
    if "hindu" in cat_lower or "culture" in cat_lower: score += 15
    if "global" in cat_lower: score += 10
    if "humanity" in cat_lower or "social" in cat_lower: score += 10
    
    return score

def get_freshness_score(collected_date_str):
    """
    PART C — Freshness Score (0–5)
    Checks if the topic is from today.
    """
    today_str = datetime.date.today().isoformat()
    if collected_date_str == today_str:
        return 5
    # If it's yesterday's news
    return 1

def is_blocked(title):
    """
    PART E — Filtering Rules
    Returns True if title contains any block words.
    """
    title_lower = title.lower()
    for word in BLOCKWORDS:
        if word in title_lower:
            return True
    return False

def calculate_final_score(doc):
    """
    PART D — Final Score Calculator
    """
    trend_s = get_trend_score(doc)
    cat_s = get_category_score(doc.get('category', ''))
    fresh_s = get_freshness_score(doc.get('collected_at', ''))
    
    total = trend_s + cat_s + fresh_s
    
    return {
        "total": total,
        "breakdown": {
            "trend": trend_s,
            "category": cat_s,
            "freshness": fresh_s
        }
    }

# ==========================================
# 🚀 MAIN PROCESSING LOOP
# ==========================================

def process_topics():
    print("--- 🧠 Step 2: Processor Started ---")
    
    # 1. Connect to DB
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    # 2. Get Today's Raw Topics
    today_str = datetime.date.today().isoformat()
    raw_cursor = db.raw_topics.find({"collected_at": today_str})
    raw_topics = list(raw_cursor)
    
    if not raw_topics:
        print("   ⚠️ No raw topics found for today. Run Step 1 (sentinel.py) first.")
        return

    print(f"   📥 Fetched {len(raw_topics)} raw topics.")

    scored_topics = []

    # 3. Filter & Score Loop
    for doc in raw_topics:
        title = doc.get('title', 'No Title')
        
        # A. Blocklist Check
        if is_blocked(title):
            print(f"   🚫 Blocked: {title[:30]}...")
            continue
            
        # B. Calculate Score
        score_data = calculate_final_score(doc)
        
        # Create the "Approved" Object
        approved_topic = {
            "title": title,
            "category": doc.get('category'),
            "source_link": doc.get('source_link'),
            "x_trending": doc.get('x_trending'),
            "trend_rank": doc.get('trend_rank'),
            "score": score_data['total'],
            "score_breakdown": score_data['breakdown'],
            "date": today_str,
            "status": "approved_for_ai", # Ready for Step 3
            "created_at": datetime.datetime.now()
        }
        
        scored_topics.append(approved_topic)

    # 4. Sort by Score (Highest First)
    scored_topics.sort(key=lambda x: x['score'], reverse=True)
    
    # 5. Pick Top 5
    top_5 = scored_topics[:5]
    
    # 6. Save to 'top_topics' Collection (Upsert to avoid dupes)
    if top_5:
        print(f"\n   🏆 Top {len(top_5)} Topics Selected:")
        for i, topic in enumerate(top_5):
            print(f"      {i+1}. [{topic['score']} pts] {topic['title'][:50]}...")
            
            # Upsert: If title exists for today, update it; otherwise insert
            db.top_topics.update_one(
                {"title": topic["title"], "date": topic["date"]}, 
                {"$set": topic}, 
                upsert=True
            )
        print("\n   ✅ Saved to 'top_topics' collection.")
    else:
        print("   ⚠️ No viable topics found after filtering.")

if __name__ == "__main__":
    process_topics()