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

export function cookieOptions(maxAge = MAX_AGE_SECONDS) {
  const isProd = process.env.NODE_ENV === "production";
  // When FRONTEND_URL is set, clients may call the API cross-origin.
  const crossSite = Boolean(
    process.env.FRONTEND_URL || process.env.CLIENT_URL,
  );
  return {
    httpOnly: true,
    sameSite: isProd && crossSite ? "none" : "lax",
    secure: isProd,
    path: "/",
    maxAge,
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
  res.clearCookie(SESSION_COOKIE, cookieOptions(0));
}

export async function getSessionFromCookies(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  return verifySessionToken(token);
}
