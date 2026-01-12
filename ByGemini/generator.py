import os
import json
import requests
import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import google.generativeai as genai
from google.api_core.exceptions import NotFound

# Load Env
load_dotenv()

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "autox_india"
OLLAMA_URL = os.getenv("OLLAMA_URL", "").strip().rstrip("/") # Removes trailing slashes
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

genai.configure(api_key=GEMINI_API_KEY)

# ==========================================
# 🔍 AUTO-DETECT MODEL NAME
# ==========================================
def get_available_model():
    """Checks Colab to see which model is actually installed."""
    headers = {"ngrok-skip-browser-warning": "69420"}
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", headers=headers, timeout=10)
        if response.status_code == 200:
            models = response.json().get('models', [])
            if models:
                # Return the first available model name (e.g., 'llama3:latest')
                return models[0]['name']
    except Exception as e:
        print(f"     ⚠️ Could not detect model: {e}")
    return "llama3:latest" # Fallback

# Detect model once at startup
OLLAMA_MODEL = get_available_model()
print(f"🤖 Using Ollama Model: {OLLAMA_MODEL}")

# ==========================================
# 🧠 API HANDLERS (OLLAMA & GEMINI)
# ==========================================

def call_remote_ollama(prompt):
    try:
        headers = {
            "ngrok-skip-browser-warning": "69420", 
            "Content-Type": "application/json"
        }
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False
        }
        
        response = requests.post(
            f"{OLLAMA_URL}/api/generate", 
            json=payload, 
            headers=headers,
            timeout=120
        )
        
        if response.status_code == 200:
            return response.json().get("response", "")
        else:
            print(f"     ❌ Ollama Error: {response.status_code} (Check if model name matches)")
            return None
    except Exception as e:
        print(f"     ❌ Connection Failed: {e}")
        return None

def call_gemini_refiner(raw_text, topic_title):
    # Prompt for refining
    prompt = f"Refine these Hinglish tweet drafts for '{topic_title}' into strict JSON. Raw Text: {raw_text}"
    
    # Try multiple models to avoid 404
    for model_name in ['gemini-1.5-flash', 'gemini-1.5-flash-001', 'gemini-pro']:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
            return json.loads(response.text)
        except:
            continue
    return None

# ==========================================
# 🚀 GENERATION LOGIC
# ==========================================

def generate_engine():
    print(f"--- ⚡ Step 3: Generator Started (Model: {OLLAMA_MODEL}) ---")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Process topics approved in Step 2
    pending = list(db.top_topics.find({"status": "approved_for_ai"}))
    
    if not pending:
        print("   💤 No new topics found.")
        return

    for topic in pending:
        print(f"\n📍 Topic: {topic['title'][:50]}...")
        
        # 1. Ollama Draft
        raw_drafts = call_remote_ollama(f"Write 3 Hinglish nationalist tweets for: {topic['title']}")
        
        if not raw_drafts:
            continue
            
        # 2. Gemini Refine
        final_json = call_gemini_refiner(raw_drafts, topic['title'])
        
        if final_json:
            # 3. Save
            db.final_tweets.insert_one({
                "topic": topic['title'],
                "source": topic.get('source_link', ''),
                "tweet_variants": final_json.get('tweet_variants', []),
                "status": "ready_for_posting",
                "generated_at": datetime.datetime.now()
            })
            db.top_topics.update_one({"_id": topic['_id']}, {"$set": {"status": "completed"}})
            print("      ✅ Success!")
        else:
            print("      ❌ Refinement failed.")

if __name__ == "__main__":
    generate_engine()