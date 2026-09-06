/**
 * Seed Neon with demo employees (~25 rows).
 * Usage: npm run db:seed
 * Optional: npm run db:seed -- --reset
 */
import { seedEmployees } from "../db/seed.js";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL. Copy .env.example → .env and add your Neon URL.");
    process.exit(1);
  }

  const reset = process.argv.includes("--reset");
  const count = await seedEmployees({ reset });
  console.log(`Seed complete: ${count} employees upserted${reset ? " (table cleared first)" : ""}.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
