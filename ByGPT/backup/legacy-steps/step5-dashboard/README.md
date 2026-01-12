# step5-dashboard (Legacy)

The unified deployable app now lives at the **repo root**.

Use the root `package.json` + `server.js` for deployment to avoid multiple installs / multiple `.env` files.

## Setup

1. Install deps:
   - `npm install`
2. Create `.env` (or copy from `.env.example`).
3. Start:
   - `npm start`
4. Open:
   - `http://localhost:3000`

## Environment

See `.env.example` for the full list.

Minimum required:
- `MONGO_URI`
- `DB_NAME`

For Step 3 AI:
- `OLLAMA_BASE_URL` (and optionally `OLLAMA_MODEL`)
- `GEMINI_API_KEY` (optional; if missing, refine is skipped)
- `AI_MODE=mock` for no-AI deployment.

## API

- `POST /api/steps/1` Run collector (news + trends) → writes to `raw_topics`
- `POST /api/steps/2` Run scoring → writes top N to `top_topics`
- `POST /api/steps/3` Generate tweets → writes to `final_tweets`
  - body: `{ "mode": "ollama" | "mock" }`
- `POST /api/steps/4` Add engagement intel → updates `final_tweets`
- `GET /api/today` Final tweets ready for manual posting
- `GET /api/state` Counts + latest docs
