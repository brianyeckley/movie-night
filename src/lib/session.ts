import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secretKey = process.env.SESSION_SECRET || "default_super_secret_local_key_for_movie_night";
const encodedKey = new TextEncoder().encode(secretKey);

export interface SessionPayload {
  userId: string;
  expiresAt: Date;
}

export async function encrypt(payload: any, expiration = "24h") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
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
