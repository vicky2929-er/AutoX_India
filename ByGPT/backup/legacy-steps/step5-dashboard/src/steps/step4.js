function generateImageKeyword(topic, tags = []) {
  if (tags.includes("hindu")) return `${topic} temple aerial view`;
  if (tags.includes("politics")) return `${topic} Indian government official press meet`;
  if (tags.includes("global")) return `${topic} India geopolitics map`;
  if (tags.includes("humanity")) return `${topic} relief operation India`;
  return `${topic} India news photo`;
}

const RETWEET_ACCOUNTS = {
  politics: ["ANI", "PIB_India"],
  hindu: ["ANI", "DDNews"],
  global: ["ANI", "Reuters"],
  humanity: ["ANI", "PTI_News"],
  general: ["ANI"]
};

function suggestRetweetAccount(tags = []) {
  for (const tag of tags) {
    if (RETWEET_ACCOUNTS[tag]) return RETWEET_ACCOUNTS[tag][0];
  }
  return "ANI";
}

const COMMENTS = [
  "Ground reality ka impact clearly dikh raha hai.",
  "Yeh sirf news nahi, New India ka direction hai.",
  "Facts khud bol rahe hain, narrative nahi.",
  "Long-term impact ka clear signal hai.",
  "Nation-first approach ka real result."
];

function generateQuoteComment() {
  return COMMENTS[Math.floor(Math.random() * COMMENTS.length)];
}

export async function runStep4({ db, log } = {}) {
  if (!db) throw new Error("runStep4 requires db");

  const finalCol = db.collection("final_tweets");

  const tweets = await finalCol.find({ status: "ready_for_manual_posting" }).toArray();
  log?.info?.(`STEP4: Loaded ${tweets.length} final tweets`);

  let updatedDocs = 0;

  for (const item of tweets) {
    const tags = item.tags || [];

    const enhancedVariants = (item.tweet_variants || []).map(variant => ({
      ...variant,
      image_keyword: generateImageKeyword(item.topic, tags),
      retweet_account: suggestRetweetAccount(tags),
      quote_comment: generateQuoteComment()
    }));

    await finalCol.updateOne(
      { _id: item._id },
      {
        $set: {
          tweet_variants: enhancedVariants,
          enhanced_at: new Date()
        }
      }
    );

    updatedDocs += 1;
  }

  const summary = { updated: updatedDocs };
  log?.info?.("STEP4: Completed", summary);

  return { summary };
}
