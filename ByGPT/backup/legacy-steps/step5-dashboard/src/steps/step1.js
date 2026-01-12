import Parser from "rss-parser";
import axios from "axios";
import { load } from "cheerio";

const parser = new Parser();

const DEFAULT_FEEDS = [
  "https://news.google.com/rss/search?q=India+Politics",
  "https://news.google.com/rss/search?q=Ram+Mandir",
  "https://news.google.com/rss/search?q=Hindu+festival",
  "https://news.google.com/rss/search?q=India+World+Politics",
  "https://economictimes.indiatimes.com/rssfeeds/Politics.xml"
];

const TAGS = {
  hindu: ["ram", "mandir", "temple", "diwali", "sanatan"],
  politics: ["modi", "bjp", "congress", "parliament", "election"],
  global: ["china", "pakistan", "usa", "ukraine", "israel", "uk"],
  humanity: ["relief", "rescue", "help", "donation"]
};

function cleanTitle(title) {
  return String(title)
    .replace(/\|.*$/g, "")
    .replace(/LIVE|Watch|Video/gi, "")
    .trim();
}

function tagTopic(title) {
  const lower = String(title).toLowerCase();
  const tags = [];

  for (const [tag, words] of Object.entries(TAGS)) {
    if (words.some(word => lower.includes(word))) {
      tags.push(tag);
    }
  }

  return tags.length ? tags : ["general"];
}

async function fetchNewsTopics({ feeds = DEFAULT_FEEDS, perFeed = 5, log }) {
  const topics = [];

  for (const feedUrl of feeds) {
    try {
      log?.debug?.(`Fetching RSS: ${feedUrl}`);
      const feed = await parser.parseURL(feedUrl);

      feed.items.slice(0, perFeed).forEach(item => {
        topics.push({
          title: item.title,
          source: feed.title,
          source_link: item.link,
          x_trending: false,
          trend_rank: null,
          createdAt: new Date()
        });
      });
    } catch (err) {
      log?.warn?.(`RSS error for ${feedUrl}`, { message: err?.message });
    }
  }

  return topics;
}

async function fetchXTrends({ limit = 5, log }) {
  const url = "https://trends24.in/india/";
  log?.debug?.(`Fetching X trends: ${url}`);

  const { data } = await axios.get(url, {
    timeout: 20000,
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; ByGPT/1.0)"
    }
  });

  const $ = load(data);
  const trends = [];

  $(".trend-card__list li a")
    .slice(0, limit)
    .each((i, el) => {
      trends.push({
        title: $(el).text().trim(),
        source: "X Trends India",
        source_link: url,
        x_trending: true,
        trend_rank: i + 1,
        createdAt: new Date()
      });
    });

  return trends;
}

export async function runStep1({ db, log, limits } = {}) {
  if (!db) throw new Error("runStep1 requires db");

  const feedsPer = limits?.newsPerFeed ?? 5;
  const trendsLimit = limits?.trends ?? 5;

  log?.info?.("STEP1: Fetching news topics...");
  const news = await fetchNewsTopics({ perFeed: feedsPer, log });

  log?.info?.("STEP1: Fetching X trends...");
  const trends = await fetchXTrends({ limit: trendsLimit, log });

  const allTopics = [...news, ...trends]
    .map(t => ({
      ...t,
      title: cleanTitle(t.title),
      tags: tagTopic(t.title)
    }))
    .filter(t => t.title);

  log?.info?.(`STEP1: Processing ${allTopics.length} topics...`);

  const rawTopics = db.collection("raw_topics");

  const ops = allTopics.map(topic => ({
    updateOne: {
      filter: { title: topic.title },
      update: { $setOnInsert: topic },
      upsert: true
    }
  }));

  const result = ops.length ? await rawTopics.bulkWrite(ops, { ordered: false }) : null;

  const summary = {
    totalFetched: allTopics.length,
    upserted: result?.upsertedCount ?? 0,
    insertedOrUpserted: result?.upsertedCount ?? 0
  };

  log?.info?.("STEP1: Completed", summary);

  return {
    summary,
    sample: allTopics.slice(0, 5)
  };
}
