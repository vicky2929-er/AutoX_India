import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { isBlocked } from "./filterUtils.js";
import { calculateFinalScore } from "./scoreUtils.js";

dotenv.config();

const client = new MongoClient(process.env.MONGO_URI);

async function runStep2() {
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const rawTopics = db.collection("raw_topics");
  const topTopics = db.collection("top_topics");

  const topics = await rawTopics
    .find({})
    .toArray();

  console.log(`🔹 Loaded ${topics.length} raw topics`);

  const scored = topics
    .filter(t => !isBlocked(t.title))
    .map(t => ({
      ...t,
      score: calculateFinalScore(t)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // TOP 5 ONLY

  if (!scored.length) {
    console.log("⚠️ No valid topics found");
    return;
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

  console.log("✅ STEP 2 COMPLETED — Top 5 topics selected");
  await client.close();
}

runStep2();
