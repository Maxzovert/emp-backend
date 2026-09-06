import { getDb, assertDb } from "./client.js";
import { decryptSecret, encryptSecret } from "../lib/auth/secrets.js";

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

  // AI provider preferences (encrypted API keys)
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_provider TEXT NOT NULL DEFAULT 'gemini'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS gemini_api_key_enc TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS openai_api_key_enc TEXT NOT NULL DEFAULT ''`;
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
    SELECT id, name, email, password_hash, department, position,
           ai_provider, gemini_api_key_enc, openai_api_key_enc,
           created_at, updated_at
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
    SELECT id, name, email, password_hash, department, position,
           ai_provider, gemini_api_key_enc, openai_api_key_enc,
           created_at, updated_at
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

export function readUserAiSecrets(row) {
  if (!row) {
    return { provider: "gemini", geminiKey: "", openaiKey: "" };
  }
  return {
    provider: (row.ai_provider || "gemini").toLowerCase(),
    geminiKey: decryptSecret(row.gemini_api_key_enc),
    openaiKey: decryptSecret(row.openai_api_key_enc),
  };
}

export async function getUserAiSettings(userId) {
  const row = await findUserById(userId);
  if (!row) return null;

  const secrets = readUserAiSecrets(row);
  const geminiConfigured = Boolean(secrets.geminiKey);
  const openaiConfigured = Boolean(secrets.openaiKey);

  // Prefer the saved provider when unlocked; otherwise first available key.
  let provider = secrets.provider === "openai" ? "openai" : "gemini";
  if (provider === "gemini" && !geminiConfigured && openaiConfigured) {
    provider = "openai";
  } else if (provider === "openai" && !openaiConfigured && geminiConfigured) {
    provider = "gemini";
  }

  return {
    provider,
    providers: [
      {
        id: "gemini",
        label: "Gemini",
        configured: geminiConfigured,
        locked: !geminiConfigured,
        hasUserKey: geminiConfigured,
        source: geminiConfigured ? "user" : null,
      },
      {
        id: "openai",
        label: "OpenAI",
        configured: openaiConfigured,
        locked: !openaiConfigured,
        hasUserKey: openaiConfigured,
        source: openaiConfigured ? "user" : null,
      },
    ],
  };
}

export async function updateUserAiSettings(
  userId,
  {
    provider,
    geminiApiKey,
    openaiApiKey,
    clearGemini = false,
    clearOpenai = false,
  } = {},
) {
  const sql = assertDb();
  await ensureUsersSchema(sql);
  const row = await findUserById(userId);
  if (!row) {
    return { success: false, error: "User not found." };
  }

  let nextProvider = (row.ai_provider || "gemini").toLowerCase();
  if (provider != null) {
    const p = String(provider).toLowerCase();
    if (p !== "gemini" && p !== "openai") {
      return { success: false, error: "Provider must be gemini or openai." };
    }
    nextProvider = p;
  }

  let geminiEnc = row.gemini_api_key_enc || "";
  let openaiEnc = row.openai_api_key_enc || "";

  if (clearGemini) geminiEnc = "";
  else if (typeof geminiApiKey === "string" && geminiApiKey.trim()) {
    geminiEnc = encryptSecret(geminiApiKey.trim());
  }

  if (clearOpenai) openaiEnc = "";
  else if (typeof openaiApiKey === "string" && openaiApiKey.trim()) {
    openaiEnc = encryptSecret(openaiApiKey.trim());
  }

  // Prevent selecting a provider with no user key (except when clearing keys)
  const geminiKey = decryptSecret(geminiEnc);
  const openaiKey = decryptSecret(openaiEnc);
  const geminiOk = Boolean(geminiKey);
  const openaiOk = Boolean(openaiKey);
  const clearingOnly =
    (clearGemini || clearOpenai) &&
    geminiApiKey == null &&
    openaiApiKey == null &&
    provider == null;

  if (!clearingOnly) {
    if (nextProvider === "gemini" && !geminiOk) {
      return {
        success: false,
        error: "Gemini is not configured. Add a Gemini API key first.",
      };
    }
    if (nextProvider === "openai" && !openaiOk) {
      return {
        success: false,
        error: "OpenAI is not configured. Add an OpenAI API key first.",
      };
    }
  } else if (nextProvider === "gemini" && !geminiOk && openaiOk) {
    nextProvider = "openai";
  } else if (nextProvider === "openai" && !openaiOk && geminiOk) {
    nextProvider = "gemini";
  }

  await sql`
    UPDATE users
    SET
      ai_provider = ${nextProvider},
      gemini_api_key_enc = ${geminiEnc},
      openai_api_key_enc = ${openaiEnc},
      updated_at = NOW()
    WHERE id = ${userId}
  `;

  const settings = await getUserAiSettings(userId);
  return { success: true, settings };
}

/**
 * Resolve provider + API key for a chat request.
 * Keys come only from the signed-in user's Settings → AI models.
 */
export async function resolveChatModelConfig(userId) {
  if (!userId) {
    return { provider: "gemini", apiKey: "", fromUser: false };
  }

  const row = await findUserById(userId);
  if (!row) {
    return { provider: "gemini", apiKey: "", fromUser: false };
  }

  const secrets = readUserAiSecrets(row);
  let provider = secrets.provider === "openai" ? "openai" : "gemini";
  let apiKey =
    provider === "openai" ? secrets.openaiKey : secrets.geminiKey;

  // Fall back to the other user key if the preferred one is missing
  if (!apiKey) {
    if (secrets.geminiKey) {
      provider = "gemini";
      apiKey = secrets.geminiKey;
    } else if (secrets.openaiKey) {
      provider = "openai";
      apiKey = secrets.openaiKey;
    }
  }

  return { provider, apiKey, fromUser: Boolean(apiKey) };
}
