const RETWEET_ACCOUNTS = {
  politics: ["ANI", "PIB_India"],
  hindu: ["ANI", "DDNews"],
  global: ["ANI", "Reuters"],
  humanity: ["ANI", "PTI_News"],
  general: ["ANI"]
};

export function suggestRetweetAccount(tags = []) {
  for (const tag of tags) {
    if (RETWEET_ACCOUNTS[tag]) {
      return RETWEET_ACCOUNTS[tag][0];
    }
  }
  return "ANI";
}
