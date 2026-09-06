import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "employeeai_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecretKey() {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "employeeai-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

/**
 * Cookie flags for the session JWT.
 *
 * Production default is SameSite=Lax so the cookie works as a first-party
 * cookie when the Vercel frontend proxies `/api` → Render (same browser origin).
 *
 * Set COOKIE_SAMESITE=none only if the browser calls Render cross-origin
 * (no Vercel rewrite / VITE_API_ALLOW_CROSS_ORIGIN).
 */
export function cookieOptions(maxAge = MAX_AGE_SECONDS) {
  const isProd = process.env.NODE_ENV === "production";
  const raw = String(process.env.COOKIE_SAMESITE || "lax").toLowerCase();
  const sameSite =
    raw === "none" || raw === "strict" || raw === "lax" ? raw : "lax";

  return {
    httpOnly: true,
    sameSite,
    secure: isProd || sameSite === "none",
    path: "/",
    maxAge,
    ...(sameSite === "none" ? { partitioned: true } : {}),
  };
}

export async function createSessionToken(user) {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload?.sub || !payload?.email) return null;
    return {
      id: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name || ""),
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

export function clearSessionCookie(res) {
  // Match the flags used when setting, or browsers may keep the cookie.
  res.clearCookie(SESSION_COOKIE, {
    ...cookieOptions(0),
    maxAge: 0,
  });
}

export async function getSessionFromCookies(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  return verifySessionToken(token);
}
