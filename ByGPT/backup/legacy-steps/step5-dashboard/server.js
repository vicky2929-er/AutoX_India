import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { getDb } from "./src/lib/db.js";
import { createRunLogger } from "./src/lib/logger.js";
import { runStep1, runStep2, runStep3, runStep4 } from "./src/steps/index.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/state", async (req, res) => {
  try {
    const db = await getDb();

    const [raw, top, final] = await Promise.all([
      db.collection("raw_topics").countDocuments(),
      db.collection("top_topics").countDocuments(),
      db.collection("final_tweets").countDocuments()
    ]);

    const latestFinal = await db
      .collection("final_tweets")
      .find({})
      .sort({ created_at: -1 })
      .limit(5)
      .toArray();

    res.json({
      ok: true,
      counts: { raw_topics: raw, top_topics: top, final_tweets: final },
      latestFinal
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

async function runWithLogs(runner) {
  const log = createRunLogger({ debugEnabled: String(process.env.DEBUG || "").toLowerCase() === "true" || process.env.DEBUG === "1" });
  const db = await getDb();
  const result = await runner({ db, log });
  return { result, logs: log.logs };
}

app.post("/api/steps/1", async (req, res) => {
  try {
    const { result, logs } = await runWithLogs(({ db, log }) =>
      runStep1({ db, log, limits: req.body?.limits })
    );
    res.json({ ok: true, result, logs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

app.post("/api/steps/2", async (req, res) => {
  try {
    const { result, logs } = await runWithLogs(({ db, log }) =>
      runStep2({ db, log, topN: req.body?.topN ?? 5 })
    );
    res.json({ ok: true, result, logs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

app.post("/api/steps/3", async (req, res) => {
  try {
    const { result, logs } = await runWithLogs(({ db, log }) =>
      runStep3({ db, log, mode: req.body?.mode })
    );
    res.json({ ok: true, result, logs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

app.post("/api/steps/4", async (req, res) => {
  try {
    const { result, logs } = await runWithLogs(({ db, log }) =>
      runStep4({ db, log })
    );
    res.json({ ok: true, result, logs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

app.get("/api/today", async (req, res) => {
  try {
    const db = await getDb();
    const tweets = await db
      .collection("final_tweets")
      .find({ status: "ready_for_manual_posting" })
      .sort({ created_at: -1 })
      .toArray();

    res.json(tweets);
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`✅ Dashboard running at http://localhost:${port}`);
});
