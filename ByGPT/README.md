# ByGPT (Unified)

This repo is now **one deployable website** at the repo root.

It runs the full pipeline as separate tasks:
- Step 1: Collect topics (RSS + X trends)
- Step 2: Score & select topics
- Step 3: Generate tweets (Ollama or Mock; optional Gemini refine)
- Step 4: Add engagement intel

The website shows **step outputs + debug logs** and also the final tweets ready for manual posting.

## Run locally

1. Install:
   - `npm install`
2. Create `.env`:
   - Copy `.env.example` → `.env`
3. Start:
   - `npm start`
4. Open:
   - `http://localhost:3000`

## Notes

- For deployment without AI keys, set `AI_MODE=mock`.
- Legacy folders were moved to `backup/legacy-steps/` for reference; deployment should use the **repo root** app only.
