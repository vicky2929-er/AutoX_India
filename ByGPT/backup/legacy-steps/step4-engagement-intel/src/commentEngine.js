const COMMENTS = [
  "Ground reality ka impact clearly dikh raha hai.",
  "Yeh sirf news nahi, New India ka direction hai.",
  "Facts khud bol rahe hain, narrative nahi.",
  "Long-term impact ka clear signal hai.",
  "Nation-first approach ka real result."
];

export function generateQuoteComment() {
  return COMMENTS[Math.floor(Math.random() * COMMENTS.length)];
}
