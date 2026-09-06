import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

/**
 * LangChain chat model factory.
 * Swap providers with AI_PROVIDER - do not call this from the client.
 */
export function getChatModel() {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const modelName = process.env.AI_MODEL_NAME || undefined;

  if (provider === "gemini" || provider === "google") {
    const apiKey =
      process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";

    if (!apiKey) {
      throw new Error(
        "Missing GOOGLE_API_KEY (or GEMINI_API_KEY). Add it to .env.local.",
      );
    }

    // Prefer Flash-Lite for low latency. Override with AI_MODEL_NAME if needed.
    return new ChatGoogleGenerativeAI({
      apiKey,
      model: modelName || "gemini-3.5-flash-lite",
      temperature: 0.2,
      maxRetries: 0,
      maxOutputTokens: 512,
      streaming: true,
      // Disable extended thinking — biggest latency win on Gemini 3.x
      thinkingConfig: { thinkingBudget: 0 },
    });
  }

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY. Add it to .env.local.");
    }

    return new ChatOpenAI({
      apiKey,
      model: modelName || "gpt-4o-mini",
      temperature: 0.2,
      maxRetries: 0,
      maxTokens: 512,
      streaming: true,
    });
  }

  throw new Error(
    `Unsupported AI_PROVIDER "${provider}". Use gemini or openai.`,
  );
}
