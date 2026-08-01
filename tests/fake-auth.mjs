/* Real session/password helpers, but Google verification stubbed so the
   handler's account-mapping logic can be tested without hitting Google. */
export { hashPassword, verifyPassword, signSession, verifySession, setSessionCookie, clearSessionCookie, requireUser, getSessionToken } from "../lib/auth.js";

export let CLIENT_ID = "test-client-id";
export let CLAIMS = null;
export function __setClientId(v) { CLIENT_ID = v; }
export function __setClaims(c) { CLAIMS = c; }

export function googleClientId() { return CLIENT_ID; }
export async function verifyGoogleIdToken(token) {
  if (token === "BAD") throw new Error("invalid token");
  return CLAIMS;
}
