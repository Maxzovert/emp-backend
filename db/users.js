import { getDb, assertDb } from "./client.js";

export async function ensureUsersSchema(sql = assertDb()) {
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
}

export function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.department || "",
    position: row.position || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findUserByEmail(email) {
  const sql = getDb();
  if (!sql) return null;
  await ensureUsersSchema(sql);
  const rows = await sql`
    SELECT id, name, email, password_hash, department, position, created_at, updated_at
    FROM users
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function findUserById(id) {
  const sql = getDb();
  if (!sql) return null;
  await ensureUsersSchema(sql);
  const rows = await sql`
    SELECT id, name, email, password_hash, department, position, created_at, updated_at
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function createUser({
  id,
  name,
  email,
  passwordHash,
  department = "",
  position = "",
}) {
  const sql = assertDb();
  await ensureUsersSchema(sql);
  const rows = await sql`
    INSERT INTO users (id, name, email, password_hash, department, position)
    VALUES (
      ${id},
      ${name},
      ${email},
      ${passwordHash},
      ${department},
      ${position}
    )
    RETURNING id, name, email, department, position, created_at, updated_at
  `;
  return mapUserRow(rows[0]);
}

export async function updateUserProfile(id, { name, email, department, position }) {
  const sql = assertDb();
  await ensureUsersSchema(sql);
  const rows = await sql`
    UPDATE users
    SET
      name = ${name},
      email = ${email},
      department = ${department},
      position = ${position},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, name, email, department, position, created_at, updated_at
  `;
  return mapUserRow(rows[0]);
}
