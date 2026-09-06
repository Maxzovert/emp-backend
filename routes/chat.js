import { Router } from "express";
import { sendMessage, streamMessage } from "../services/ai/aiService.js";

const router = Router();

function sseEncode(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

router.post("/", async (req, res) => {
  try {
    const message = req.body?.message;
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const stream = req.body?.stream !== false;

    if (typeof message !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Message must be a string." });
    }

    if (!stream) {
      const result = await sendMessage({ message, history });
      const status = result.success
        ? 200
        : result.error?.includes("empty")
          ? 400
          : 503;
      return res.status(status).json(result);
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const push = (payload) => {
      res.write(sseEncode(payload));
    };

    try {
      push({ type: "status", text: "started" });

      const result = await streamMessage({
        message,
        history,
        onToken: (text) => push({ type: "token", text }),
      });

      if (!result.success) {
        push({
          type: "error",
          error: result.error || "Unable to reach the AI service.",
        });
      } else {
        push({
          type: "done",
          message: result.message,
          meta: result.meta || null,
        });
      }
    } catch {
      push({ type: "error", error: "Unable to reach the AI service." });
    } finally {
      res.end();
    }
  } catch {
    if (!res.headersSent) {
      res
        .status(500)
        .json({ success: false, error: "Unable to reach the AI service." });
    } else {
      res.end();
    }
  }
});

export default router;
