import {
  getUserByGoogleSub, getUserByEmail, createUserFull, linkGoogleSub,
  upsertProgress, getProgress, uniqueUsername, ensureAuthSchema,
} from "../../lib/db.js";
import { verifyGoogleIdToken, googleClientId, signSession, setSessionCookie } from "../../lib/auth.js";

// Google Sign-In. The browser sends the ID token issued by Google Identity
// Services; it is verified here against Google's public keys (no client
// secret involved), then mapped to an account:
//   known google_sub        -> sign in
//   same email, no google   -> link Google to that existing account
//   otherwise               -> create a new account
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!googleClientId()) {
    return res.status(503).json({ error: "গুগল লগইন এখনো চালু হয়নি (GOOGLE_CLIENT_ID সেট করা নেই)" });
  }

  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: "গুগল টোকেন পাওয়া যায়নি" });

  let claims;
  try {
    claims = await verifyGoogleIdToken(credential);
  } catch {
    return res.status(401).json({ error: "গুগল যাচাই ব্যর্থ — আবার চেষ্টা করো" });
  }
  const sub = String(claims.sub);
  const mail = (claims.email || "").toLowerCase();
  // যাচাই না হওয়া ইমেইল দিয়ে অন্যের অ্যাকাউন্টে ঢোকা ঠেকাও
  const mailVerified = claims.email_verified === true || claims.email_verified === "true";

  try {
    await ensureAuthSchema();
    let user = await getUserByGoogleSub(sub);

    if (!user && mail && mailVerified) {
      const byMail = await getUserByEmail(mail);
      if (byMail) user = await linkGoogleSub(byMail.id, sub, mail);
    }
    if (!user) {
      const display = await uniqueUsername(claims.name || (mail ? mail.split("@")[0] : "শিক্ষার্থী"));
      user = await createUserFull({
        username: display,
        email: mailVerified ? mail : null,
        googleSub: sub,
        passwordHash: null,
        isAdmin: false,
      });
      await upsertProgress(user.id, {});
    }

    const state = (await getProgress(user.id)) || {};
    const token = await signSession({ id: user.id, username: user.username, isAdmin: user.is_admin });
    setSessionCookie(res, token);
    return res.status(200).json({ username: user.username, isAdmin: user.is_admin, state });
  } catch {
    return res.status(500).json({ error: "গুগল দিয়ে প্রবেশ করা যায়নি — একটু পরে আবার চেষ্টা করো" });
  }
}
