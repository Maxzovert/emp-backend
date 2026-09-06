/**
 * Apply employees schema to Neon.
 * Usage: npm run db:migrate
 * Requires DATABASE_URL in .env
 */
import { migrateEmployees } from "../db/seed.js";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL. Copy .env.example → .env and add your Neon URL.");
    process.exit(1);
  }

  await migrateEmployees();
  console.log("Migration complete: employees table ready.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
