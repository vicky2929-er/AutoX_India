import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { generateImageKeyword } from "./imageEngine.js";
import { suggestRetweetAccount } from "./retweetEngine.js";
import { generateQuoteComment } from "./commentEngine.js";

dotenv.config();
const client = new MongoClient(process.env.MONGO_URI);

async function runStep4() {
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const finalCol = db.collection("final_tweets");

  const tweets = await finalCol
    .find({ status: "ready_for_manual_posting" })
    .toArray();

  for (const item of tweets) {
    const enhancedVariants = item.tweet_variants.map(variant => ({
      ...variant,
      image_keyword: generateImageKeyword(
        item.topic,
        item.tags || []
      ),
      retweet_account: suggestRetweetAccount(item.tags || []),
      quote_comment: generateQuoteComment()
    }));

    await finalCol.updateOne(
      { _id: item._id },
      {
        $set: {
          tweet_variants: enhancedVariants,
          enhanced_at: new Date()
        }
      }
    );
  }

  console.log("✅ STEP 4 COMPLETED — Engagement intelligence added");
  await client.close();
}

runStep4();
