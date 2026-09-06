import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import employeesRoutes from "./routes/employees.js";
import chatRoutes from "./routes/chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === "production";

const app = express();

// Render / Vercel sit behind reverse proxies — required for secure cookies.
app.set("trust proxy", 1);

function buildCorsOrigin() {
  const allowed = [process.env.FRONTEND_URL, process.env.CLIENT_URL]
    .filter(Boolean)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);

  if (!isProd) {
    return [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      ...allowed,
    ];
  }

  // Reflect request origin when unset; otherwise whitelist FRONTEND_URL
  return allowed.length > 0 ? allowed : true;
}

app.use(
  cors({
    origin: buildCorsOrigin(),
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

// Serve SPA only when frontend was built into the deploy artifact.
// On Render API-only deploys, frontend/dist is missing — skip silently.
const distCandidates = [
  process.env.FRONTEND_DIST,
  path.join(__dirname, "public"),
  path.join(__dirname, "..", "frontend", "dist"),
].filter(Boolean);

const dist = distCandidates.find((dir) =>
  fs.existsSync(path.join(dir, "index.html")),
);

if (isProd && dist) {
  app.use(express.static(dist));
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    res.sendFile(path.join(dist, "index.html"));
  });
  console.log(`Serving frontend from ${dist}`);
} else if (isProd) {
  console.log(
    "No frontend dist found — running API-only (set FRONTEND_URL for CORS).",
  );
}

app.use((err, _req, res, _next) => {
  console.error("[server]", err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: status === 404 ? "Not found." : "Internal server error.",
  });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
