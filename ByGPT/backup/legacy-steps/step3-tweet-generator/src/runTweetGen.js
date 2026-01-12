import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { generateWithOllama } from "./ollamaClient.js";
import { refineWithGemini } from "./geminiRefiner.js";
import { parseTweets } from "./tweetParser.js";

dotenv.config();
const client = new MongoClient(process.env.MONGO_URI);

async function runStep3() {
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const topicsCol = db.collection("top_topics");
  const finalCol = db.collection("final_tweets");

  const topics = await topicsCol
    .find({ status: "approved_for_ai" })
    .toArray();

  console.log(`🔹 Loaded ${topics.length} topics approved_for_ai`);

  for (const topic of topics) {
    console.log(`🧠 Generating tweets for: ${topic.title}`);

    const raw = await generateWithOllama(topic);
    const refined = await refineWithGemini(raw);
    const tweets = parseTweets(refined);

    await finalCol.updateOne(
      { topic: topic.title },
      {
        $set: {
          topic: topic.title,
          tags: topic.tags || [],
          source: topic.source,
          source_link: topic.source_link,
          tweet_variants: tweets,
          created_at: new Date(),
          status: "ready_for_manual_posting"
        }
      },
      { upsert: true }
    );

    await topicsCol.updateOne(
      { _id: topic._id },
      { $set: { status: "tweet_generated", tweetGeneratedAt: new Date() } }
    );
  }

  console.log("✅ STEP 3 COMPLETED — Tweets generated");
  await client.close();
}

runStep3();
