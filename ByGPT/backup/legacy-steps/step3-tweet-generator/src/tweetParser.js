export function parseTweets(text) {
  const raw = String(text || "");
  const blocks = raw.split(/\bTWEET:\s*/i).slice(1);

  return blocks
    .map(block => {
      const lines = block
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

      const pick = label => {
        const re = new RegExp(`${label}\\s*(.*)`, "i");
        const match = lines.find(l => re.test(l));
        if (!match) return "";
        return match.replace(re, "$1").trim();
      };

      const firstLabelIdx = lines.findIndex(l => /^(CONTEXT:|IMAGE_KEYWORD:|RETWEET_ACCOUNT:|HASHTAGS:)/i.test(l));
      const tweetText = (firstLabelIdx === -1 ? lines : lines.slice(0, firstLabelIdx)).join(" ").trim();

      const hashtagsLine = pick("HASHTAGS:");
      const hashtags = hashtagsLine
        .split(/\s+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => (s.startsWith("#") ? s : `#${s}`));

      return {
        tweet: tweetText,
        context: pick("CONTEXT:"),
        image_keyword: pick("IMAGE_KEYWORD:"),
        retweet_account: pick("RETWEET_ACCOUNT:"),
        hashtags
      };
    })
    .filter(t => t.tweet);
}
