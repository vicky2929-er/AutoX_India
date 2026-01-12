const BLOCKWORDS = [
  "movie",
  "trailer",
  "box office",
  "celebrity",
  "match highlights",
  "ipl",
  "cricket score",
  "football"
];

export function isBlocked(title) {
  const lower = title.toLowerCase();
  return BLOCKWORDS.some(word => lower.includes(word));
}
