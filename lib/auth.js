import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";

/* ── গুগল সাইন-ইন ──
   ব্রাউজার Google Identity Services থেকে একটি ID টোকেন (JWT) পাঠায়। সেটি
   গুগলের পাবলিক কী দিয়ে যাচাই করলেই নিশ্চিত হওয়া যায় কে সাইন-ইন করেছে —
   কোনো client secret লাগে না, শুধু GOOGLE_CLIENT_ID মিলতে হয়। */
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
export function googleClientId() { return process.env.GOOGLE_CLIENT_ID || ""; }
export async function verifyGoogleIdToken(idToken) {
  const aud = googleClientId();
  if (!aud) throw new Error("GOOGLE_CLIENT_ID env var is not set");
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: aud,
  });
  if (!payload.sub) throw new Error("google token has no subject");
  return payload; // sub, email, email_verified, name, picture
}

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function signSession({ id, username, isAdmin }) {
  return new SignJWT({ username, isAdmin })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
    .sign(secretKey());
}

export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return { id: Number(payload.sub), username: payload.username, isAdmin: !!payload.isAdmin };
  } catch {
    return null;
  }
}

export function getSessionToken(req) {
  return req.cookies?.[SESSION_COOKIE] || null;
}

export function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_S}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
}

export async function requireUser(req, res) {
  const token = getSessionToken(req);
  const session = token ? await verifySession(token) : null;
  if (!session) {
    res.status(401).json({ error: "not signed in" });
    return null;
  }
  return session;
}
