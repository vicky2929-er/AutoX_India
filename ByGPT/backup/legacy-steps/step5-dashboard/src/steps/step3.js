import axios from "axios";

function buildPrompt(topic) {
  return `
You are an Indian nationalist commentator.

Language: Hinglish.
Tone: Confident, factual, patriotic.
Audience: Indian users on X.
Rules:
- No abusive or hateful language
- No fake claims
- Max 240 characters per tweet
- 1 emoji max
- Encourage replies subtly

Create 3 DIFFERENT tweet versions on the SAME topic.

For EACH tweet provide clearly separated sections:
TWEET:
CONTEXT:
IMAGE_KEYWORD:
RETWEET_ACCOUNT:
HASHTAGS:

Topic: ${topic.title}
Reference source: ${topic.source_link}
`;
}

function parseTweets(text, { log } = {}) {
  const raw = String(text || "");
  const blocks = raw.split(/\bTWEET:\s*/i).slice(1);

  const tweets = blocks
    .map(block => {
      const lines = block
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

      const joined = lines.join("\n");

      const pick = label => {
        const re = new RegExp(`${label}\\s*(.*)`, "i");
        const match = lines.find(l => re.test(l));
        if (!match) return "";
        return match.replace(re, "$1").trim();
      };

      // Tweet text is the first line until we hit a known label
      const firstLabelIdx = lines.findIndex(l => /^(CONTEXT:|IMAGE_KEYWORD:|RETWEET_ACCOUNT:|HASHTAGS:)/i.test(l));
      const tweetText = (firstLabelIdx === -1 ? lines : lines.slice(0, firstLabelIdx)).join(" ").trim();

      const hashtagsLine = pick("HASHTAGS:");
      const hashtags = hashtagsLine
        .split(/\s+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => (s.startsWith("#") ? s : `#${s}`));

      const parsed = {
        tweet: tweetText,
        context: pick("CONTEXT:"),
        image_keyword: pick("IMAGE_KEYWORD:"),
        retweet_account: pick("RETWEET_ACCOUNT:"),
        hashtags
      };

      if (!parsed.tweet) {
        log?.warn?.("STEP3: Parsed a tweet block with empty tweet text", { blockPreview: joined.slice(0, 200) });
      }

      return parsed;
    })
    .filter(t => t.tweet);

  return tweets;
}

async function generateWithOllama(topic, { log } = {}) {
  const baseUrl = process.env.OLLAMA_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing env: OLLAMA_BASE_URL (e.g. http://localhost:11434)");
  }

  const url = `${baseUrl.replace(/\/$/, "")}/api/generate`;
  log?.info?.(`STEP3: Ollama generate: ${url}`);

  const response = await axios.post(
    url,
    {
      model: process.env.OLLAMA_MODEL || "llama3",
      prompt: buildPrompt(topic),
      stream: false
    },
    { timeout: 120000 }
  );

  return response.data?.response ?? "";
}

async function refineWithGemini(text, { log } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    log?.warn?.("STEP3: GEMINI_API_KEY missing; skipping Gemini refine");
    return text;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`;
  const body = {
    contents: [
      {
        parts: [
          {
            text: `
Refine the following tweets:
- Make Hinglish crisp
- Remove aggressive or risky words
- Keep nationalist tone
- Improve clarity
- Do NOT add new facts

Text:
${text}
`
          }
        ]
      }
    ]
  };

  log?.info?.("STEP3: Refining with Gemini...");
  const res = await axios.post(url, body, { timeout: 60000 });
  return res.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? text;
}

function makeMockOutput(topic) {
  return `TWEET:
${topic.title} — ek important update. Aapka take kya hai?
CONTEXT:
Source: ${topic.source_link}
IMAGE_KEYWORD:
${topic.title} India news photo
RETWEET_ACCOUNT:
ANI
HASHTAGS:
#India #News

TWEET:
Facts matter. ${topic.title} par clear discussion zaroori hai.
CONTEXT:
Source: ${topic.source_link}
IMAGE_KEYWORD:
${topic.title} press conference
RETWEET_ACCOUNT:
PIB_India
HASHTAGS:
#India #Politics

TWEET:
${topic.title} ka long-term impact dekhna hoga. Opinions?
CONTEXT:
Source: ${topic.source_link}
IMAGE_KEYWORD:
${topic.title} India trending
RETWEET_ACCOUNT:
DDNews
HASHTAGS:
#India #Update`;
}

export async function runStep3({ db, log, mode } = {}) {
  if (!db) throw new Error("runStep3 requires db");

  const effectiveMode = mode || process.env.AI_MODE || "ollama"; // ollama | mock

  const topicsCol = db.collection("top_topics");
  const finalCol = db.collection("final_tweets");

  const topics = await topicsCol.find({ status: "approved_for_ai" }).toArray();
  log?.info?.(`STEP3: Loaded ${topics.length} topics approved_for_ai`);

  const results = [];

  for (const topic of topics) {
    log?.info?.(`STEP3: Generating tweets for: ${topic.title}`);

    const raw =
      effectiveMode === "mock" ? makeMockOutput(topic) : await generateWithOllama(topic, { log });

    const refined = await refineWithGemini(raw, { log });
    const tweets = parseTweets(refined, { log });

    await finalCol.updateOne(
      { topic: topic.title },
      {
        $set: {
          topic: topic.title,
          tags: topic.tags || [],
          source: topic.source,
          source_link: topic.source_link,
          tweet_variants: tweets,
          created_at: new Date(),
          status: "ready_for_manual_posting"
        }
      },
      { upsert: true }
    );

    await topicsCol.updateOne(
      { _id: topic._id },
      { $set: { status: "tweet_generated", tweetGeneratedAt: new Date() } }
    );

    results.push({ topic: topic.title, variants: tweets.length });
  }

  const summary = { processed: results.length, mode: effectiveMode };
  log?.info?.("STEP3: Completed", summary);

  return { summary, results };
}
