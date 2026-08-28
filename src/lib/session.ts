import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const DEV_FALLBACK_SECRET = "insecure_local_development_key_do_not_deploy";

let cachedKey: Uint8Array | null = null;

/**
 * The HMAC key used to sign session cookies.
 *
 * A committed fallback would let anyone who can read this repository mint a
 * valid admin session, so in production the secret must come from the
 * environment. This is resolved lazily rather than at module scope because
 * `next build` evaluates modules with NODE_ENV=production, and the build has
 * no reason to hold a runtime secret.
 */
function getSigningKey(): Uint8Array {
  if (cachedKey) return cachedKey;

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET is not set. Refusing to sign sessions with a default key."
      );
    }
    console.warn(
      "SESSION_SECRET is not set - using the insecure development key."
    );
  }

  cachedKey = new TextEncoder().encode(secret || DEV_FALLBACK_SECRET);
  return cachedKey;
}

export async function encrypt(
  payload: Record<string, unknown>,
  expiration = "24h"
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(getSigningKey());
}

export async function decrypt(session: string | undefined = "") {
  // Resolved outside the try so a missing SESSION_SECRET surfaces as a
  // configuration error rather than being swallowed as "not signed in".
  const key = getSigningKey();

  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    // An invalid, expired or tampered token is simply "not signed in".
    return null;
  }
}

export async function createSession(userId: string, role: string, rememberMe: boolean) {
  // If rememberMe is checked, set 10 years cookie, otherwise 24 hours
  const durationMs = rememberMe 
    ? 10 * 365 * 24 * 60 * 60 * 1000 
    : 24 * 60 * 60 * 1000;
  
  const expirationStr = rememberMe ? "3650d" : "24h";
  const expiresAt = new Date(Date.now() + durationMs);

  const session = await encrypt({ userId, role }, expirationStr);
  const cookieStore = await cookies();

  cookieStore.set("movie_night_session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("movie_night_session");
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("movie_night_session")?.value;
  if (!session) return null;
  return decrypt(session);
}

// ----------------------------------------------------------------------
// STATELESS CRYPTOGRAPHIC MATH CAPTCHA HELPERS
// ----------------------------------------------------------------------

export interface CaptchaPayload {
  answer: string;
  expiresAt: number;
}

export async function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 9) + 1;
  const num2 = Math.floor(Math.random() * 9) + 1;
  const answer = String(num1 + num2);
  const question = `What is ${num1} + ${num2}?`;

  // Create a captcha token valid for 5 minutes
  const captchaToken = await encrypt({ answer, expiresAt: Date.now() + 5 * 60 * 1000 }, "5m");

  return {
    question,
    token: captchaToken,
  };
}

export async function verifyCaptcha(token: string | undefined, userAnswer: string) {
  if (!token || !userAnswer) return false;
  
  const payload = await decrypt(token) as unknown as CaptchaPayload | null;
  if (!payload) return false;

  // Check expiration
  if (Date.now() > payload.expiresAt) {
    return false;
  }

  // Check answer match (case-insensitive, trimmed)
  return payload.answer.trim() === userAnswer.trim();
}
