import { neon } from "@neondatabase/serverless";

/**
 * Neon SQL client. Server-only - never import from client components.
 * Returns null when DATABASE_URL is missing so the app can boot before Neon is configured.
 */
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return null;
  }
  return neon(url);
}

export function assertDb() {
  const sql = getDb();
  if (!sql) {
    throw new Error(
      "DATABASE_URL is not configured. Add it to .env (see .env.example).",
    );
  }
  return sql;
}
