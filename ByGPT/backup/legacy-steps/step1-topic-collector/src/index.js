import { fetchNewsTopics } from "./fetchNews.js";
import { fetchXTrends } from "./fetchXTrends.js";
import { cleanTitle, tagTopic } from "./cleanAndTag.js";
import { saveTopics } from "./saveToDB.js";

async function runStep1() {
  console.log("🔹 Fetching news topics...");
  const news = await fetchNewsTopics();

  console.log("🔹 Fetching X trends...");
  const trends = await fetchXTrends();

  let allTopics = [...news, ...trends];

  const processed = allTopics.map(t => ({
    ...t,
    title: cleanTitle(t.title),
    tags: tagTopic(t.title)
  }));

  await saveTopics(processed);
  console.log("🎯 STEP 1 COMPLETED SUCCESSFULLY");
}

runStep1();
