# Backend Flow Diagram

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Express Server                            │
│                       (server.js - Port 3000)                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ├─── Static Files: /public
                       ├─── API Endpoints
                       └─── Database: MongoDB (via getDb())
```

---

## Main API Endpoints

### 1. GET `/api/state`
**Purpose**: Get current system state and statistics

```
┌─────────────────────┐
│  GET /api/state     │
└──────────┬──────────┘
           │
           ├─► Count raw_topics collection
           ├─► Count top_topics collection
           ├─► Count final_tweets collection
           └─► Fetch latest 5 final_tweets (sorted by created_at DESC)
           │
           ▼
    ┌──────────────────────────┐
    │  Return JSON Response:   │
    │  - counts {}             │
    │  - latestFinal []        │
    └──────────────────────────┘
```

### 2. GET `/api/today`
**Purpose**: Get all tweets ready for manual posting

```
┌─────────────────────┐
│  GET /api/today     │
└──────────┬──────────┘
           │
           ├─► Query final_tweets collection
           │   Filter: { status: "ready_for_manual_posting" }
           │   Sort: { created_at: -1 }
           │
           ▼
    ┌──────────────────────────┐
    │  Return Array of Tweets  │
    └──────────────────────────┘
```

---

## Processing Pipeline (4 Steps)

### POST `/api/steps/1` - Topic Collection
**Step 1: Collect topics from RSS feeds and X Trends**

```
┌──────────────────────────┐
│  POST /api/steps/1       │
│  Body: { limits? }       │
└───────────┬──────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────┐
│              STEP 1: Topic Collector                │
│                 (step1.js)                          │
└──────────┬──────────────────────────────────────────┘
           │
           ├─► Fetch RSS News Feeds (Default 5 per feed)
           │   Sources:
           │   - Google News RSS (India Politics)
           │   - Google News RSS (Ram Mandir)
           │   - Google News RSS (Hindu Festival)
           │   - Google News RSS (India World Politics)
           │   - Economic Times (Politics)
           │   │
           │   Extract: title, source, source_link
           │   Set: x_trending = false
           │
           ├─► Fetch X (Twitter) Trends (Default 5 trends)
           │   Source: https://trends24.in/india/
           │   Scrape using Cheerio
           │   Extract: title, trend_rank
           │   Set: x_trending = true
           │
           ├─► Clean & Tag All Topics
           │   - Clean titles (remove LIVE, Watch, etc.)
           │   - Auto-tag topics:
           │     • hindu: ram, mandir, temple, diwali, sanatan
           │     • politics: modi, bjp, congress, parliament
           │     • global: china, pakistan, usa, ukraine, israel
           │     • humanity: relief, rescue, help, donation
           │
           ├─► Save to Database
           │   Collection: raw_topics
           │   Operation: Bulk upsert (based on title)
           │
           ▼
    ┌─────────────────────────────────────┐
    │  Return:                            │
    │  - summary { totalFetched,          │
    │              upserted }             │
    │  - sample (first 5 topics)          │
    └─────────────────────────────────────┘
```

---

### POST `/api/steps/2` - Topic Scoring & Selection
**Step 2: Score topics and select top N**

```
┌──────────────────────────┐
│  POST /api/steps/2       │
│  Body: { topN: 5 }       │
└───────────┬──────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────┐
│              STEP 2: Topic Scoring                  │
│                 (step2.js)                          │
└──────────┬──────────────────────────────────────────┘
           │
           ├─► Load all raw_topics from DB
           │
           ├─► Filter Blocked Topics
           │   Block keywords:
           │   - movie, trailer, box office, celebrity
           │   - match highlights, ipl, cricket score, football
           │
           ├─► Calculate Score for Each Topic
           │   Score = X Trend Score + Category Score + Freshness Score
           │   │
           │   ├─ X Trend Score:
           │   │  • Rank 1-3: 40 points
           │   │  • Rank 4-5: 30 points
           │   │  • Rank 6+:  20 points
           │   │  • Not trending: 0 points
           │   │
           │   ├─ Category Score:
           │   │  • politics tag: +20
           │   │  • hindu tag:    +15
           │   │  • global tag:   +10
           │   │  • humanity tag: +10
           │   │
           │   └─ Freshness Score:
           │      • ≤6 hours:  +5
           │      • ≤12 hours: +3
           │      • >12 hours: +1
           │
           ├─► Sort by Score (Descending)
           │
           ├─► Select Top N Topics (default 5)
           │
           ├─► Save Selected Topics
           │   Collection: top_topics
           │   Update fields:
           │   - title, tags, score, x_trending, trend_rank
           │   - source, source_link
           │   - status: "approved_for_ai"
           │   - selectedAt: new Date()
           │
           ▼
    ┌─────────────────────────────────────┐
    │  Return:                            │
    │  - selected [] (top scored topics)  │
    │  - summary { loaded, selected }     │
    └─────────────────────────────────────┘
```

---

### POST `/api/steps/3` - Tweet Generation
**Step 3: Generate tweet variants using AI**

```
┌──────────────────────────┐
│  POST /api/steps/3       │
│  Body: { mode? }         │
└───────────┬──────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────┐
│            STEP 3: Tweet Generator                  │
│                 (step3.js)                          │
└──────────┬──────────────────────────────────────────┘
           │
           ├─► Load Topics from top_topics
           │   Filter: { status: "approved_for_ai" }
           │
           │   For each topic:
           │
           ├─► Build AI Prompt
           │   Context:
           │   - Topic title & source link
           │   - Language: Hinglish
           │   - Tone: Confident, factual, patriotic
           │   - Rules: Max 240 chars, 1 emoji max
           │   - Request: 3 different tweet versions
           │
           ├─► Generate with AI (Mode Selection)
           │   │
           │   ├─ Mode: "ollama" (default)
           │   │  POST to OLLAMA_BASE_URL/api/generate
           │   │  Model: llama3 (or env OLLAMA_MODEL)
           │   │  Timeout: 120 seconds
           │   │
           │   ├─ Mode: "mock"
           │   │  Return pre-formatted mock tweets
           │   │
           │   └─ Mode: env AI_MODE (fallback)
           │
           ├─► Refine with Gemini (Optional)
           │   If GEMINI_API_KEY present:
           │   - POST to Google Gemini API
           │   - Refine: crisp Hinglish, remove risky words
           │   - Keep nationalist tone
           │   - Improve clarity
           │
           ├─► Parse Tweet Response
           │   Extract for each variant:
           │   - TWEET: (main tweet text)
           │   - CONTEXT: (background info)
           │   - IMAGE_KEYWORD: (for image search)
           │   - RETWEET_ACCOUNT: (suggested account)
           │   - HASHTAGS: (space-separated tags)
           │
           ├─► Save to Database
           │   Collection: final_tweets
           │   Upsert by topic name:
           │   - topic, tags, source, source_link
           │   - tweet_variants [] (array of 3 variants)
           │   - status: "ready_for_manual_posting"
           │   - created_at
           │
           ├─► Update Source Topic
           │   Collection: top_topics
           │   Update status: "tweet_generated"
           │   Set tweetGeneratedAt
           │
           ▼
    ┌─────────────────────────────────────┐
    │  Return:                            │
    │  - summary { processed, mode }      │
    │  - results [] (topics processed)    │
    └─────────────────────────────────────┘
```

---

### POST `/api/steps/4` - Engagement Enhancement
**Step 4: Add engagement metadata (images, retweet suggestions, comments)**

```
┌──────────────────────────┐
│  POST /api/steps/4       │
└───────────┬──────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────┐
│        STEP 4: Engagement Enhancement               │
│                 (step4.js)                          │
└──────────┬──────────────────────────────────────────┘
           │
           ├─► Load Tweets from final_tweets
           │   Filter: { status: "ready_for_manual_posting" }
           │
           │   For each tweet document:
           │
           ├─► Generate Image Keywords
           │   Based on tags:
           │   - hindu → "temple aerial view"
           │   - politics → "Indian government press meet"
           │   - global → "India geopolitics map"
           │   - humanity → "relief operation India"
           │   - general → "India news photo"
           │
           ├─► Suggest Retweet Accounts
           │   Based on tags:
           │   - politics → ANI, PIB_India
           │   - hindu → ANI, DDNews
           │   - global → ANI, Reuters
           │   - humanity → ANI, PTI_News
           │   - general → ANI
           │
           ├─► Generate Quote Comments (Random)
           │   Options:
           │   - "Ground reality ka impact clearly dikh raha hai."
           │   - "Yeh sirf news nahi, New India ka direction hai."
           │   - "Facts khud bol rahe hain, narrative nahi."
           │   - "Long-term impact ka clear signal hai."
           │   - "Nation-first approach ka real result."
           │
           ├─► Enhance All Tweet Variants
           │   For each variant, add:
           │   - image_keyword
           │   - retweet_account
           │   - quote_comment
           │
           ├─► Update Database
           │   Collection: final_tweets
           │   Update: tweet_variants with enhanced data
           │   Set: enhanced_at timestamp
           │
           ▼
    ┌─────────────────────────────────────┐
    │  Return:                            │
    │  - summary { updated }              │
    └─────────────────────────────────────┘
```

---

## Database Collections

### 1. **raw_topics**
**Purpose**: Store all fetched topics from news & trends
```
{
  _id: ObjectId,
  title: String,           // Topic title
  source: String,          // Source name (e.g., "Google News")
  source_link: String,     // Original URL
  x_trending: Boolean,     // Is it from X trends?
  trend_rank: Number|null, // Rank if from X trends
  tags: [String],          // Auto-generated tags
  createdAt: Date          // When fetched
}
```

### 2. **top_topics**
**Purpose**: Store scored and selected top topics
```
{
  _id: ObjectId,
  title: String,
  tags: [String],
  score: Number,           // Calculated total score
  x_trending: Boolean,
  trend_rank: Number|null,
  source: String,
  source_link: String,
  status: String,          // "approved_for_ai" → "tweet_generated"
  selectedAt: Date,
  tweetGeneratedAt: Date?
}
```

### 3. **final_tweets**
**Purpose**: Store generated tweets ready for posting
```
{
  _id: ObjectId,
  topic: String,           // Topic title
  tags: [String],
  source: String,
  source_link: String,
  tweet_variants: [        // Array of 3 tweet versions
    {
      tweet: String,       // Main tweet text
      context: String,
      image_keyword: String,
      retweet_account: String,
      hashtags: [String],
      quote_comment: String  // Added in Step 4
    }
  ],
  status: String,          // "ready_for_manual_posting"
  created_at: Date,
  enhanced_at: Date?       // When Step 4 ran
}
```

---

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION                              │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │   Frontend (Web UI)   │
                    │   public/index.html   │
                    └───────────┬───────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
    ┌───────────────┐   ┌──────────────┐   ┌──────────────┐
    │ View State    │   │ Run Steps    │   │ View Tweets  │
    │ GET /api/state│   │ POST /api/   │   │ GET /api/    │
    │               │   │ steps/1-4    │   │ today        │
    └───────┬───────┘   └──────┬───────┘   └──────┬───────┘
            │                  │                   │
            └──────────────────┼───────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Express Server    │
                    │    (server.js)      │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   runWithLogs()     │
                    │   - Creates logger  │
                    │   - Gets DB conn    │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐     ┌────────────────┐    ┌────────────────┐
│   STEP 1      │────▶│   STEP 2       │───▶│   STEP 3       │
│ Fetch Topics  │     │ Score & Select │    │ Generate Tweets│
└───────┬───────┘     └────────┬───────┘    └────────┬───────┘
        │                      │                      │
        │                      │                      │
        ▼                      ▼                      ▼
   raw_topics              top_topics           final_tweets
   collection              collection           collection
        │                      │                      │
        └──────────────────────┴──────────────────────┤
                                                      │
                                              ┌───────▼───────┐
                                              │   STEP 4      │
                                              │ Add Engagement│
                                              │   Metadata    │
                                              └───────┬───────┘
                                                      │
                                                      ▼
                                              final_tweets
                                              (enhanced)
                                                      │
                                                      ▼
                                        ┌─────────────────────────┐
                                        │  Manual Review & Post   │
                                        │  via /api/today         │
                                        └─────────────────────────┘
```

---

## External Dependencies

### APIs & Services
1. **RSS Feeds** (Step 1)
   - Google News RSS
   - Economic Times RSS

2. **Web Scraping** (Step 1)
   - trends24.in (X/Twitter trends)
   - Uses: axios + cheerio

3. **AI Services** (Step 3)
   - **Ollama** (Primary): Local LLM API
   - **Google Gemini** (Refiner): Optional refinement

### Environment Variables
```env
# Database
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=autox_india

# AI Services
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
GEMINI_API_KEY=your_key_here
AI_MODE=ollama|mock

# Server
PORT=3000
DEBUG=true|false
```

---

## Key Features

### 1. **Logging System**
- Created via `createRunLogger()`
- Debug mode controlled by env DEBUG
- Returns logs array with each API response

### 2. **Error Handling**
- Try-catch blocks on all endpoints
- Returns `{ ok: false, error: message }` on failure
- Returns `{ ok: true, result, logs }` on success

### 3. **Database Operations**
- Singleton DB connection via `getDb()`
- Bulk operations for efficiency (Step 1)
- Upsert operations to avoid duplicates
- Status-based workflow (approved_for_ai → tweet_generated)

### 4. **AI Flexibility**
- Supports multiple modes (ollama/mock)
- Optional Gemini refinement
- Fallback to mock data if AI unavailable

### 5. **Content Filtering**
- Blocks entertainment content (movies, sports)
- Prioritizes politics, religion, global affairs
- Freshness-based scoring

---

## Workflow Summary

```
1. Collect Topics (Step 1)
   ↓ RSS Feeds + X Trends → raw_topics

2. Score & Select (Step 2)
   ↓ Filter + Score + Top N → top_topics

3. Generate Tweets (Step 3)
   ↓ AI Prompt + Parse → final_tweets

4. Enhance (Step 4)
   ↓ Add metadata → final_tweets (enhanced)

5. Manual Review
   ↓ View via /api/today → Post to X
```

---

## Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: MongoDB
- **AI**: Ollama (LLaMA3) + Google Gemini
- **Scraping**: Axios + Cheerio + RSS Parser
- **Frontend**: Vanilla HTML/CSS/JS
- **Language**: ES6 Modules

---

*Generated: January 12, 2026*
