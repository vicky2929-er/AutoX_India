const BLOCKWORDS = [
  "movie",
  "trailer",
  "box office",
  "celebrity",
  "match highlights",
  "ipl",
  "cricket score",
  "football"
];

function isBlocked(title) {
  const lower = String(title || "").toLowerCase();
  return BLOCKWORDS.some(word => lower.includes(word));
}

function xTrendScore(topic) {
  if (!topic.x_trending) return 0;

  if (topic.trend_rank <= 3) return 40;
  if (topic.trend_rank <= 5) return 30;
  return 20;
}

function categoryScore(tags = []) {
  let score = 0;

  if (tags.includes("politics")) score += 20;
  if (tags.includes("hindu")) score += 15;
  if (tags.includes("global")) score += 10;
  if (tags.includes("humanity")) score += 10;

  return score;
}

function freshnessScore(createdAt) {
  const hoursOld = (Date.now() - new Date(createdAt)) / (1000 * 60 * 60);

  if (hoursOld <= 6) return 5;
  if (hoursOld <= 12) return 3;
  return 1;
}

function calculateFinalScore(topic) {
  return xTrendScore(topic) + categoryScore(topic.tags) + freshnessScore(topic.createdAt);
}

export async function runStep2({ db, log, topN = 5 } = {}) {
  if (!db) throw new Error("runStep2 requires db");

  const rawTopics = db.collection("raw_topics");
  const topTopics = db.collection("top_topics");

  const topics = await rawTopics.find({}).toArray();
  log?.info?.(`STEP2: Loaded ${topics.length} raw topics`);

  const scored = topics
    .filter(t => !isBlocked(t.title))
    .map(t => ({
      ...t,
      score: calculateFinalScore(t)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  if (!scored.length) {
    log?.warn?.("STEP2: No valid topics found after filtering");
    return { selected: [], summary: { loaded: topics.length, selected: 0 } };
  }

  for (const topic of scored) {
    await topTopics.updateOne(
      { title: topic.title },
      {
        $set: {
          title: topic.title,
          tags: topic.tags,
          score: topic.score,
          x_trending: topic.x_trending,
          trend_rank: topic.trend_rank,
          source: topic.source,
          source_link: topic.source_link,
          status: "approved_for_ai",
          selectedAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  const summary = { loaded: topics.length, selected: scored.length };
  log?.info?.("STEP2: Completed", summary);

  return { selected: scored, summary };
}
