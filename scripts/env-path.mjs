import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Pick the first existing env file so scripts work with .env or .env.local.
 */
export function resolveEnvFile(cwd = process.cwd()) {
  const candidates = [".env.local", ".env"];
  for (const name of candidates) {
    const full = resolve(cwd, name);
    if (existsSync(full)) return full;
  }
  return null;
}
