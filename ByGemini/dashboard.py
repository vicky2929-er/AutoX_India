import os
import datetime
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# ⚙️ CONFIGURATION
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "autox_india"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

# Serve static files (css/js if you had them separate, but we'll inline for simplicity)
# app.mount("/static", StaticFiles(directory="static"), name="static")

# ==========================================
# 📡 API ENDPOINTS
# ==========================================

@app.get("/api/today")
def get_todays_tweets():
    """
    Fetches all tweets ready for posting.
    Sorts by 'Enhanced' status so best ones are on top.
    """
    tweets = list(db.final_tweets.find({
        "status": "ready_for_posting"
    }).sort("enhanced", -1))
    
    # Convert ObjectId to string for JSON serialization
    for t in tweets:
        t["_id"] = str(t["_id"])
        
    return tweets

@app.post("/api/mark_posted/{tweet_id}")
def mark_as_posted(tweet_id: str):
    """
    Archives a tweet so it disappears from the dashboard.
    """
    result = db.final_tweets.update_one(
        {"_id": ObjectId(tweet_id)},
        {"$set": {
            "status": "posted",
            "posted_at": datetime.datetime.now()
        }}
    )
    if result.modified_count == 1:
        return {"msg": "Success"}
    raise HTTPException(status_code=404, detail="Tweet not found")

# ==========================================
# 🖥️ FRONTEND (Single Page Application)
# ==========================================

@app.get("/", response_class=HTMLResponse)
def serve_dashboard():
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AutoX India | Editor's Desk</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-slate-900 text-slate-100 min-h-screen p-6">

        <header class="max-w-6xl mx-auto mb-8 flex justify-between items-center border-b border-slate-700 pb-4">
            <div>
                <h1 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-green-500">
                    🇮🇳 AutoX India Dashboard
                </h1>
                <p class="text-slate-400 text-sm mt-1">Review, Copy, Post. Monetization Safe.</p>
            </div>
            <button onclick="loadTweets()" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-semibold">
                <i class="fas fa-sync-alt"></i> Refresh
            </button>
        </header>

        <main id="app" class="max-w-6xl mx-auto space-y-8">
            <div id="loading" class="text-center text-slate-500 py-20 hidden">
                <i class="fas fa-spinner fa-spin text-3xl"></i>
                <p class="mt-2">Fetching Intelligence...</p>
            </div>

            <div id="tweets-container" class="space-y-12"></div>
        </main>

        <script>
            async function loadTweets() {
                document.getElementById('loading').classList.remove('hidden');
                document.getElementById('tweets-container').innerHTML = '';

                try {
                    const res = await fetch('/api/today');
                    const tweets = await res.json();

                    if (tweets.length === 0) {
                        document.getElementById('tweets-container').innerHTML = `
                            <div class="text-center text-slate-500 py-10">
                                <h2 class="text-xl">✅ All Caught Up!</h2>
                                <p>No tweets pending review.</p>
                            </div>`;
                        return;
                    }

                    tweets.forEach(renderTweetBlock);

                } catch (err) {
                    console.error(err);
                    alert("Error loading tweets. Check backend.");
                } finally {
                    document.getElementById('loading').classList.add('hidden');
                }
            }

            function renderTweetBlock(doc) {
                const container = document.getElementById('tweets-container');
                
                // TOPIC HEADER
                const section = document.createElement('section');
                section.className = "bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg";
                
                let variantsHtml = '';
                doc.tweet_variants.forEach((v, idx) => {
                    variantsHtml += `
                        <div class="bg-slate-900 rounded-lg p-5 border border-slate-700 relative group hover:border-orange-500 transition-all">
                            <div class="absolute -top-3 left-4 bg-slate-700 text-xs px-2 py-1 rounded border border-slate-600 uppercase tracking-wide text-slate-300">
                                Variant ${idx + 1}: ${v.type || 'Standard'}
                            </div>

                            <p class="mt-2 text-lg text-slate-200 font-medium leading-relaxed">${v.tweet}</p>
                            
                            <div class="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                                <span class="bg-slate-800 px-2 py-1 rounded">Length: ${v.tweet.length} chars</span>
                                ${(v.hashtags || []).map(h => `<span class="text-blue-400">${h}</span>`).join(' ')}
                            </div>

                            <div class="mt-4 bg-slate-800/50 p-3 rounded text-sm space-y-2 border border-slate-700/50">
                                <div class="flex justify-between items-center">
                                    <span class="text-slate-400"><i class="fas fa-image mr-2"></i>Image Key:</span>
                                    <div class="flex gap-2">
                                        <code class="bg-black/30 px-2 py-0.5 rounded text-orange-300 truncate max-w-[150px]">${v.image_keyword}</code>
                                        <button onclick="copyToClip('${v.image_keyword}')" class="text-slate-400 hover:text-white"><i class="fas fa-copy"></i></button>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-slate-400"><i class="fas fa-retweet mr-2"></i>Quote Target:</span>
                                    <div class="flex gap-2">
                                        <code class="bg-black/30 px-2 py-0.5 rounded text-green-300">${v.retweet_suggestion}</code>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-slate-400"><i class="fas fa-comment-dots mr-2"></i>Quote Comment:</span>
                                    <div class="flex gap-2">
                                        <code class="bg-black/30 px-2 py-0.5 rounded text-blue-300 truncate max-w-[150px]">${v.quote_comment}</code>
                                        <button onclick="copyToClip('${v.quote_comment}')" class="text-slate-400 hover:text-white"><i class="fas fa-copy"></i></button>
                                    </div>
                                </div>
                            </div>

                            <button onclick="copyTweet('${v.tweet.replace(/'/g, "\\'")}')" class="w-full mt-4 bg-green-600 hover:bg-green-500 text-white py-2 rounded font-bold shadow-md transition-colors flex justify-center items-center gap-2">
                                <i class="fas fa-copy"></i> COPY TWEET
                            </button>
                        </div>
                    `;
                });

                section.innerHTML = `
                    <div class="flex justify-between items-start mb-6 border-b border-slate-700 pb-4">
                        <div>
                            <h2 class="text-2xl font-bold text-white mb-1">
                                ${doc.topic}
                            </h2>
                            <div class="flex gap-3 text-sm">
                                <a href="${doc.source}" target="_blank" class="text-blue-400 hover:underline"><i class="fas fa-external-link-alt"></i> Source</a>
                                <span class="text-slate-500">•</span>
                                <span class="text-slate-400">Generated: ${new Date(doc.generated_at).toLocaleTimeString()}</span>
                            </div>
                        </div>
                        <button onclick="markDone('${doc._id}')" class="bg-red-500/20 hover:bg-red-500/40 text-red-400 px-3 py-1 rounded text-sm border border-red-500/30">
                            <i class="fas fa-check"></i> Mark Posted
                        </button>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        ${variantsHtml}
                    </div>
                `;

                container.appendChild(section);
            }

            // --- UTILS ---

            async function copyToClip(text) {
                await navigator.clipboard.writeText(text);
                // Simple toast could go here
            }

            async function copyTweet(text) {
                await navigator.clipboard.writeText(text);
                // You could auto-open twitter here if you wanted
                // window.open('https://twitter.com/compose/tweet', '_blank');
            }

            async function markDone(id) {
                if(!confirm("Did you post this? It will be removed from the list.")) return;
                
                await fetch('/api/mark_posted/' + id, { method: 'POST' });
                loadTweets(); // Reload
            }

            // Init
            loadTweets();
        </script>
    </body>
    </html>
    """
    return html_content

if __name__ == "__main__":
    import uvicorn
    # Runs on localhost:8000
    print("🚀 Dashboard running at: http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)