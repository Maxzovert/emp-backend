import { randomUUID } from "crypto";
import {
  createUser,
  findUserByEmail,
  findUserById,
  mapUserRow,
  updateUserProfile,
  ensureUsersSchema,
} from "../db/users.js";
import { assertDb, getDb } from "../db/client.js";
import { hashPassword, verifyPassword } from "../lib/auth/password.js";
import {
  clearSessionCookie,
  createSessionToken,
  getSessionFromCookies,
  setSessionCookie,
} from "../lib/auth/session.js";
import { DEMO_PROFILE } from "../data/employees.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(row) {
  if (!row) return null;
  return mapUserRow(row);
}

export async function ensureDemoUser() {
  const sql = getDb();
  if (!sql) return null;

  await ensureUsersSchema(sql);
  const existing = await findUserByEmail(DEMO_PROFILE.email);
  if (existing) return publicUser(existing);

  const passwordHash = await hashPassword("password123");
  return createUser({
    id: randomUUID(),
    name: DEMO_PROFILE.name,
    email: DEMO_PROFILE.email,
    passwordHash,
    department: DEMO_PROFILE.department,
    position: DEMO_PROFILE.position,
  });
}

export async function registerUser(res, {
  name,
  email,
  password,
  department = "",
  position = "",
}) {
  if (!getDb()) {
    return {
      success: false,
      error: "Database is not configured. Add DATABASE_URL to use auth.",
    };
  }

  const trimmedName = String(name || "").trim();
  const trimmedEmail = String(email || "").trim().toLowerCase();
  const trimmedPassword = String(password || "");

  if (!trimmedName) return { success: false, error: "Name is required." };
  if (!EMAIL_RE.test(trimmedEmail)) {
    return { success: false, error: "Enter a valid email." };
  }
  if (trimmedPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const existing = await findUserByEmail(trimmedEmail);
  if (existing) {
    return { success: false, error: "An account with that email already exists." };
  }

  const passwordHash = await hashPassword(trimmedPassword);
  const user = await createUser({
    id: randomUUID(),
    name: trimmedName,
    email: trimmedEmail,
    passwordHash,
    department: String(department || "").trim(),
    position: String(position || "").trim(),
  });

  const token = await createSessionToken(user);
  setSessionCookie(res, token);

  return { success: true, user };
}

export async function loginUser(res, { email, password }) {
  if (!getDb()) {
    return {
      success: false,
      error: "Database is not configured. Add DATABASE_URL to use auth.",
    };
  }

  await ensureDemoUser();

  const trimmedEmail = String(email || "").trim().toLowerCase();
  const trimmedPassword = String(password || "");

  if (!EMAIL_RE.test(trimmedEmail) || !trimmedPassword) {
    return { success: false, error: "Invalid email or password." };
  }

  const row = await findUserByEmail(trimmedEmail);
  if (!row) {
    return { success: false, error: "Invalid email or password." };
  }

  const valid = await verifyPassword(trimmedPassword, row.password_hash);
  if (!valid) {
    return { success: false, error: "Invalid email or password." };
  }

  const user = publicUser(row);
  const token = await createSessionToken(user);
  setSessionCookie(res, token);

  return { success: true, user };
}

export async function logoutUser(res) {
  clearSessionCookie(res);
  return { success: true };
}

export async function getCurrentUser(req) {
  const session = await getSessionFromCookies(req);
  if (!session) return null;

  if (!getDb()) {
    return {
      id: session.id,
      name: session.name,
      email: session.email,
      department: "",
      position: "",
    };
  }

  try {
    await ensureDemoUser();
    const row = await findUserById(session.id);
    return publicUser(row);
  } catch {
    return null;
  }
}

export async function updateCurrentUserProfile(req, res, input) {
  const current = await getCurrentUser(req);
  if (!current) {
    return { success: false, error: "You must be signed in." };
  }

  assertDb();

  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const department = String(input.department || "").trim();
  const position = String(input.position || "").trim();

  if (!name) return { success: false, error: "Name is required." };
  if (!EMAIL_RE.test(email)) {
    return { success: false, error: "Enter a valid email." };
  }

  const other = await findUserByEmail(email);
  if (other && other.id !== current.id) {
    return { success: false, error: "That email is already in use." };
  }

  const user = await updateUserProfile(current.id, {
    name,
    email,
    department,
    position,
  });

  const token = await createSessionToken(user);
  setSessionCookie(res, token);

  return { success: true, user };
}
