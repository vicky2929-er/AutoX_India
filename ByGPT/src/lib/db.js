import { MongoClient } from "mongodb";

let client;

export async function getMongoClient() {
  if (!process.env.MONGO_URI) {
    throw new Error("Missing env: MONGO_URI");
  }

  if (!client) {
    client = new MongoClient(process.env.MONGO_URI);
  }

  // In mongodb v6, connect() is safe to call multiple times.
  await client.connect();

  return client;
}

export async function getDb() {
  if (!process.env.DB_NAME) {
    throw new Error("Missing env: DB_NAME");
  }
  const mongo = await getMongoClient();
  return mongo.db(process.env.DB_NAME);
}

export async function closeMongoClient() {
  if (client) {
    await client.close();
    client = undefined;
  }
}
