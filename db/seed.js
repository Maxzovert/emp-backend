import { assertDb } from "./client.js";
import { DEMO_EMPLOYEES } from "../data/employees.js";

export async function migrateEmployees() {
  const sql = assertDb();
  await sql`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      position TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      avatar TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function seedEmployees({ reset = false } = {}) {
  const sql = assertDb();
  await migrateEmployees();

  if (reset) {
    await sql`DELETE FROM employees`;
  }

  for (const employee of DEMO_EMPLOYEES) {
    await sql`
      INSERT INTO employees (id, name, department, position, email, avatar, status, joined_at)
      VALUES (
        ${employee.id},
        ${employee.name},
        ${employee.department},
        ${employee.position},
        ${employee.email},
        ${employee.avatar || null},
        ${employee.status},
        ${employee.joinedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        department = EXCLUDED.department,
        position = EXCLUDED.position,
        email = EXCLUDED.email,
        avatar = EXCLUDED.avatar,
        status = EXCLUDED.status,
        joined_at = EXCLUDED.joined_at
    `;
  }

  return DEMO_EMPLOYEES.length;
}
