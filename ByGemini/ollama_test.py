import os
import requests
from dotenv import load_dotenv

load_dotenv()

# 1. Get URL from .env
OLLAMA_URL = os.getenv("OLLAMA_URL")
# Make sure this matches what you pulled in Colab (llama3, phi3, etc.)
MODEL_NAME = "llama3" 

print(f"🔎 Testing Connection to: {OLLAMA_URL}")

if not OLLAMA_URL:
    print("❌ ERROR: OLLAMA_URL is missing in .env file")
    exit()

# 2. Define Headers (Critical for Ngrok)
headers = {
    "ngrok-skip-browser-warning": "true",
    "Content-Type": "application/json"
}

# 3. Simple Prompt Payload
payload = {
    "model": MODEL_NAME,
    "prompt": "Say 'Hello from Google Colab' if you can hear me.",
    "stream": False
}

try:
    print("⏳ Sending request... (Wait 10s)")
    response = requests.post(
        f"{OLLAMA_URL}/api/generate", 
        json=payload, 
        headers=headers, 
        timeout=30
    )

    # 4. Check Response
    if response.status_code == 200:
        print("\n✅ SUCCESS! Connected to Colab.")
        print(f"🤖 AI Response: {response.json().get('response')}")
    else:
        print(f"\n❌ FAILED. Status Code: {response.status_code}")
        print(f"⚠️ Response Text: {response.text[:200]}") # Print first 200 chars to see error
        
except Exception as e:
    print(f"\n❌ CONNECTION ERROR: {e}")