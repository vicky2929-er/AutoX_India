import axios from "axios";

export async function refineWithGemini(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const body = {
    contents: [{
      parts: [{
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
      }]
    }]
  };

  const res = await axios.post(url, body);
  return res.data.candidates[0].content.parts[0].text;
}
