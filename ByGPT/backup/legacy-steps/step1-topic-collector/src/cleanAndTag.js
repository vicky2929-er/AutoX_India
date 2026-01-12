const TAGS = {
  hindu: ["ram", "mandir", "temple", "diwali", "sanatan"],
  politics: ["modi", "bjp", "congress", "parliament", "election"],
  global: ["china", "pakistan", "usa", "ukraine", "israel"],
  humanity: ["relief", "rescue", "help", "donation"]
};

export function cleanTitle(title) {
  return title
    .replace(/\|.*$/g, "")
    .replace(/LIVE|Watch|Video/gi, "")
    .trim();
}

export function tagTopic(title) {
  const lower = title.toLowerCase();
  let tags = [];

  for (const [tag, words] of Object.entries(TAGS)) {
    if (words.some(word => lower.includes(word))) {
      tags.push(tag);
    }
  }

  return tags.length ? tags : ["general"];
}
