import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const PREFIX = "v1";

function getKey() {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "employeeai-dev-secret-change-me";
  return scryptSync(secret, "employeeai-ai-keys", 32);
}

/** Encrypt a secret string for DB storage. Empty input → empty string. */
export function encryptSecret(plain) {
  const value = String(plain || "");
  if (!value) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(".");
}

/** Decrypt a stored secret. Returns "" on failure/empty. */
export function decryptSecret(payload) {
  const raw = String(payload || "");
  if (!raw) return "";
  try {
    const [version, ivB64, tagB64, dataB64] = raw.split(".");
    if (version !== PREFIX || !ivB64 || !tagB64 || !dataB64) return "";
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(ivB64, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

export function maskSecret(plain) {
  const value = String(plain || "");
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 3)}••••${value.slice(-4)}`;
}
