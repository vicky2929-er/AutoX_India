import axios from "axios";
import { buildPrompt } from "./promptBuilder.js";

// NGROK OLLAMA BASE URL
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "https://2f3a-34-123-45.ngrok-free.app";

export async function generateWithOllama(topic) {
  try {
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: "llama3",
        prompt: buildPrompt(topic),
        stream: false
      },
      {
        timeout: 120000 // 2 minutes (ngrok + CPU can be slow)
      }
    );

    return response.data.response;
  } catch (error) {
    console.error("❌ Ollama NGROK Error:", error.message);
    throw error;
  }
}
