export function xTrendScore(topic) {
  if (!topic.x_trending) return 0;

  if (topic.trend_rank <= 3) return 40;
  if (topic.trend_rank <= 5) return 30;
  return 20;
}

export function categoryScore(tags = []) {
  let score = 0;

  if (tags.includes("politics")) score += 20;
  if (tags.includes("hindu")) score += 15;
  if (tags.includes("global")) score += 10;
  if (tags.includes("humanity")) score += 10;

  return score;
}

export function freshnessScore(createdAt) {
  const hoursOld =
    (Date.now() - new Date(createdAt)) / (1000 * 60 * 60);

  if (hoursOld <= 6) return 5;
  if (hoursOld <= 12) return 3;
  return 1;
}

export function calculateFinalScore(topic) {
  return (
    xTrendScore(topic) +
    categoryScore(topic.tags) +
    freshnessScore(topic.createdAt)
  );
}
