import { buildEmployeeContext } from "./context.js";
import { getChatModel } from "./model.js";
import { buildChatMessages } from "./prompts.js";

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.text) return part.text;
        return "";
      })
      .join("");
  }
  return String(content ?? "");
}

function validateMessage(message) {
  const trimmed = String(message ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "Message cannot be empty." };
  }
  if (trimmed.length > 2000) {
    return { ok: false, error: "Message is too long." };
  }
  return { ok: true, trimmed };
}

function toSafeError(error) {
  const raw = error?.message || "Unable to reach the AI service.";
  console.error("[aiService]", raw);

  if (
    /api key|API_KEY|not configured|Settings|401|403|permission|invalid.*key/i.test(
      raw,
    )
  ) {
    if (/api key|API_KEY|invalid.*key|401|403|permission/i.test(raw)) {
      return "Your AI API key was rejected. Check the key in Settings → AI models.";
    }
    return raw.includes("Settings")
      ? raw
      : "No AI provider is configured. Add an API key in Settings → AI models.";
  }

  if (/404|not found|model/i.test(raw)) {
    return "The selected AI model is unavailable. Try again or switch provider in Settings.";
  }

  if (/400|invalid argument|Bad Request/i.test(raw)) {
    return "The AI provider rejected the request. Check your API key and try again.";
  }

  return "Unable to reach the AI service. Check your connection and try again.";
}

async function prepareChat({
  message,
  history = [],
  contextOptions = {},
  modelOptions = {},
}) {
  const check = validateMessage(message);
  if (!check.ok) {
    return { success: false, error: check.error };
  }

  const context = await buildEmployeeContext({
    message: check.trimmed,
    ...contextOptions,
  });

  const llm = getChatModel(modelOptions);
  const messages = buildChatMessages({
    userMessage: check.trimmed,
    employeeContext: context.text,
    history,
  });

  return {
    success: true,
    trimmed: check.trimmed,
    llm,
    messages,
    context,
    provider: (modelOptions.provider || "gemini").toLowerCase(),
  };
}

export async function sendMessage({
  message,
  history = [],
  contextOptions = {},
  modelOptions = {},
}) {
  try {
    const prepared = await prepareChat({
      message,
      history,
      contextOptions,
      modelOptions,
    });
    if (!prepared.success) return prepared;

    const response = await prepared.llm.invoke(prepared.messages);
    const text = extractText(response?.content).trim();

    if (!text) {
      return {
        success: false,
        error: "The AI returned an empty response. Please try again.",
      };
    }

    return {
      success: true,
      message: text,
      meta: {
        contextRows: prepared.context.rowCount,
        contextSource: prepared.context.source,
        provider: prepared.provider,
      },
    };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function streamMessage({
  message,
  history = [],
  contextOptions = {},
  modelOptions = {},
  onToken,
}) {
  try {
    const prepared = await prepareChat({
      message,
      history,
      contextOptions,
      modelOptions,
    });
    if (!prepared.success) return prepared;

    let full = "";
    const stream = await prepared.llm.stream(prepared.messages);

    for await (const chunk of stream) {
      const piece = extractText(chunk?.content);
      if (!piece) continue;
      full += piece;
      onToken?.(piece);
    }

    const text = full.trim();
    if (!text) {
      return {
        success: false,
        error: "The AI returned an empty response. Please try again.",
      };
    }

    return {
      success: true,
      message: text,
      meta: {
        contextRows: prepared.context.rowCount,
        contextSource: prepared.context.source,
        provider: prepared.provider,
      },
    };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}
