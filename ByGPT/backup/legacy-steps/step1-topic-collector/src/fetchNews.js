import Parser from "rss-parser";
const parser = new Parser();

const FEEDS = [
  "https://news.google.com/rss/search?q=India+Politics",
  "https://news.google.com/rss/search?q=Ram+Mandir",
  "https://news.google.com/rss/search?q=Hindu+festival",
  "https://news.google.com/rss/search?q=India+World+Politics",
  "https://economictimes.indiatimes.com/rssfeeds/Politics.xml"
];

export async function fetchNewsTopics() {
  let topics = [];

  for (const feedUrl of FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);

      feed.items.slice(0, 5).forEach(item => {
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
      console.error("RSS Error:", feedUrl);
    }
  }

  return topics;
}
