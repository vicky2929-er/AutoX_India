import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
client = MongoClient(os.getenv("MONGO_URI"))
db = client["autox_india"]

print("📊 DATABASE DIAGNOSTICS")
print("-----------------------")
print(f"1. Raw Topics (Sentinel):   {db.raw_topics.count_documents({})} items")
print(f"2. Top Topics (Processor):  {db.top_topics.count_documents({})} items")
print(f"3. Final Tweets (Generator):{db.final_tweets.count_documents({})} items")
print("-----------------------")

# Check specifically for Dashboard-ready tweets
ready_count = db.final_tweets.count_documents({"status": "ready_for_posting"})
print(f"✅ Ready for Dashboard:      {ready_count} items")

if ready_count == 0:
    print("\n❌ PROBLEM: No tweets are ready.")
    print("👉 SOLUTION: You need to run 'python generator.py' again now that Ngrok is fixed.")
else:
    print(f"\n✅ SUCCESS: {ready_count} tweets are waiting. Check http://127.0.0.1:8000 again.")