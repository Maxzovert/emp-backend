import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

/**
 * LangChain chat model factory.
 * Requires explicit { provider, apiKey } from the user's Settings → AI models.
 */
export function getChatModel(options = {}) {
  const provider = String(options.provider || "gemini").toLowerCase();
  const modelName = options.modelName || undefined;
  const apiKey = String(options.apiKey || "").trim();

  if (!apiKey) {
    throw new Error(
      "No AI provider is configured. Add an API key in Settings → AI models.",
    );
  }

  if (provider === "gemini" || provider === "google") {
    return new ChatGoogleGenerativeAI({
      apiKey,
      model: modelName || process.env.AI_MODEL_NAME || "gemini-3.5-flash-lite",
      temperature: 0.2,
      maxRetries: 0,
      maxOutputTokens: 512,
      streaming: true,
    });
  }

  if (provider === "openai") {
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
    `Unsupported AI provider "${provider}". Choose Gemini or OpenAI in Settings.`,
  );
}
