import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const client = new MongoClient(process.env.MONGO_URI);

export async function saveTopics(topics) {
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const collection = db.collection("raw_topics");

  for (const topic of topics) {
    await collection.updateOne(
      { title: topic.title },
      { $setOnInsert: topic },
      { upsert: true }
    );
  }

  console.log(`✅ Saved ${topics.length} topics`);
  await client.close();
}
