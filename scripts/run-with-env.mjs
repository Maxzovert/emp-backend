import { spawnSync } from "child_process";
import { resolveEnvFile } from "./env-path.mjs";

const script = process.argv[2];
if (!script) {
  console.error("Usage: node scripts/run-with-env.mjs <script.mjs> [...args]");
  process.exit(1);
}

const envFile = resolveEnvFile();
const args = envFile
  ? [`--env-file=${envFile}`, script, ...process.argv.slice(3)]
  : [script, ...process.argv.slice(3)];

if (!envFile) {
  console.warn("No .env or .env.local found. Continuing without env file.");
}

const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  cwd: process.cwd(),
});

process.exit(result.status ?? 1);