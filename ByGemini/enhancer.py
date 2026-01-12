import os
from pymongo import MongoClient
from dotenv import load_dotenv
import google.generativeai as genai
from google.api_core.exceptions import NotFound

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "autox_india"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

# ... [Keep your existing RETWEET_ACCOUNTS and IMAGE_SUFFIXES dicts here] ...
# (Or just copy the full file below if you want to be safe)

RETWEET_ACCOUNTS = {
    "politics": ["@ANI", "@PIB_India", "@PTI_News"],
    "hindu": ["@ANI", "@DDNewsLive", "@Indiaculturenic"],
    "global": ["@ANI", "@ReutersIndia", "@DrSJaishankar"],
    "humanity": ["@ANI", "@NDRFHQ", "@adgpi"],
    "default": ["@ANI", "@XBreakingIndia"]
}

IMAGE_SUFFIXES = {
    "hindu": "temple aerial view high resolution",
    "politics": "India government official event photo",
    "global": "India map geopolitics context",
    "humanity": "relief operation India site photo",
    "default": "news context image India"
}

def get_smart_retweet_target(category_str):
    cat_lower = (category_str or "").lower()
    if "politics" in cat_lower: return RETWEET_ACCOUNTS["politics"][0]
    if "hindu" in cat_lower: return RETWEET_ACCOUNTS["hindu"][0]
    if "global" in cat_lower: return RETWEET_ACCOUNTS["global"][0]
    if "humanity" in cat_lower: return RETWEET_ACCOUNTS["humanity"][0]
    return RETWEET_ACCOUNTS["default"][0]

def get_smart_image_keyword(topic_title, category_str):
    cat_lower = (category_str or "").lower()
    suffix = IMAGE_SUFFIXES["default"]
    if "hindu" in cat_lower: suffix = IMAGE_SUFFIXES["hindu"]
    elif "politics" in cat_lower: suffix = IMAGE_SUFFIXES["politics"]
    elif "global" in cat_lower: suffix = IMAGE_SUFFIXES["global"]
    elif "humanity" in cat_lower: suffix = IMAGE_SUFFIXES["humanity"]
    
    clean_topic = "".join(e for e in topic_title if e.isalnum() or e.isspace())
    return f"{clean_topic} {suffix}"

def generate_quote_comment(tweet_text):
    """
    Safe Gemini call with Fallback
    """
    prompt = f"Read this tweet: '{tweet_text}'. Write a 1-line Quote-Retweet comment in HINGLISH (Max 10 words, Nationalist/Deshbhakt tone). No hashtags."
    
    models_to_try = ['gemini-1.5-flash', 'gemini-1.5-flash-001', 'gemini-pro']
    
    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            return response.text.strip().replace('"', '')
        except:
            continue
            
    return "Ye update important hai, zaroor padhein." # Hard fallback

def run_enhancer():
    print("--- 🧠 Step 4: Intelligence Enhancer Started ---")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    pending_docs = list(db.final_tweets.find({
        "status": "ready_for_posting",
        "enhanced": {"$ne": True}
    }))
    
    if not pending_docs:
        print("   💤 No new tweets to enhance.")
        return

    print(f"   ⚡ Enhancing {len(pending_docs)} tweet packages...")

    for doc in pending_docs:
        topic_title = doc.get('topic', '')
        variants = doc.get('tweet_variants', [])
        enhanced_variants = []

        print(f"   🔹 Processing: {topic_title[:30]}...")

        for v in variants:
            smart_image = get_smart_image_keyword(topic_title, "General")
            smart_retweet = get_smart_retweet_target("General")
            quote_comment = generate_quote_comment(v['tweet'])
            
            v['image_keyword'] = smart_image
            v['retweet_suggestion'] = smart_retweet
            v['quote_comment'] = quote_comment
            enhanced_variants.append(v)
            
        db.final_tweets.update_one(
            {"_id": doc['_id']},
            {"$set": {"tweet_variants": enhanced_variants, "enhanced": True}}
        )
        print("      ✅ Done.")

    print("--- 🏁 Enhancement Complete. ---")

if __name__ == "__main__":
    run_enhancer()