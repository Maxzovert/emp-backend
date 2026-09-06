import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import employeesRoutes from "./routes/employees.js";
import chatRoutes from "./routes/chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";

const app = express();

app.use(
  cors({
    origin: isProd ? true : ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Lightweight keep-alive for Render / uptime monitors (no auth, no DB)
app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    status: "up",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    status: "up",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/chat", chatRoutes);

if (isProd) {
  const dist = path.join(__dirname, "..", "frontend", "dist");
  app.use(express.static(dist));
  // Express 5 named wildcard (bare "*" is invalid)
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.use((err, _req, res, _next) => {
  console.error("[server]", err);
  res.status(500).json({ success: false, error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
