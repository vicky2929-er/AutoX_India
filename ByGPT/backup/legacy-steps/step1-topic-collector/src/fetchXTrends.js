import axios from "axios";
import { load } from "cheerio";

export async function fetchXTrends() {
  const url = "https://trends24.in/india/";
  const { data } = await axios.get(url);
  const $ = load(data);

  let trends = [];

  $(".trend-card__list li a").slice(0, 5).each((i, el) => {
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
