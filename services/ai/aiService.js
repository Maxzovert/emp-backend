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
  const safe =
    /api key|GOOGLE_API_KEY|GEMINI_API_KEY|OPENAI_API_KEY|AI_PROVIDER/i.test(raw)
      ? raw
      : "Unable to reach the AI service. Check your connection and try again.";
  console.error("[aiService]", raw);
  return safe;
}

async function prepareChat({ message, history = [], contextOptions = {} }) {
  const check = validateMessage(message);
  if (!check.ok) {
    return { success: false, error: check.error };
  }

  const context = await buildEmployeeContext({
    message: check.trimmed,
    ...contextOptions,
  });

  const llm = getChatModel();
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
  };
}

/**
 * Public AI entry used by /api/chat (non-streaming).
 */
export async function sendMessage({
  message,
  history = [],
  contextOptions = {},
}) {
  try {
    const prepared = await prepareChat({ message, history, contextOptions });
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
      },
    };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

/**
 * Stream tokens for /api/chat SSE responses.
 * onToken(textChunk) is called as pieces arrive.
 */
export async function streamMessage({
  message,
  history = [],
  contextOptions = {},
  onToken,
}) {
  try {
    const prepared = await prepareChat({ message, history, contextOptions });
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
      },
    };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}
