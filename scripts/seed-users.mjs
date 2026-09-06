/**
 * Ensure users table exists and seed the demo account.
 * Usage: npm run db:seed-users (or via db:setup)
 */
import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const DEMO = {
  name: "John Carter",
  email: "john.carter@employeeai.app",
  password: "password123",
  department: "Product",
  position: "Product Manager",
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL.");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const existing = await sql`
    SELECT id FROM users WHERE lower(email) = lower(${DEMO.email}) LIMIT 1
  `;

  if (existing[0]) {
    console.log("Demo user already exists:", DEMO.email);
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO.password, 10);
  await sql`
    INSERT INTO users (id, name, email, password_hash, department, position)
    VALUES (
      ${randomUUID()},
      ${DEMO.name},
      ${DEMO.email},
      ${passwordHash},
      ${DEMO.department},
      ${DEMO.position}
    )
  `;

  console.log("Demo user created:", DEMO.email, "/", DEMO.password);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
