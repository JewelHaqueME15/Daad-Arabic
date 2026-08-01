import { getUserByEmail, createUserFull, upsertProgress, uniqueUsername, ensureAuthSchema } from "../../lib/db.js";
import { hashPassword, signSession, setSessionCookie } from "../../lib/auth.js";

// Email + password sign-up. Unlike the legacy name-only accounts this always
// requires a real password, so an account cannot be opened by anyone who
// simply guesses the display name.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const { email, password, name, wantsAdmin, adminCode } = req.body || {};
  const mail = (email || "").trim().toLowerCase();
  const pass = String(password || "");
  if (!EMAIL_RE.test(mail)) return res.status(400).json({ error: "ঠিকঠাক একটি ইমেইল দাও" });
  if (pass.length < 6) return res.status(400).json({ error: "পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে" });

  let isAdmin = false;
  if (wantsAdmin) {
    if (!adminCode || adminCode !== process.env.ADMIN_SIGNUP_CODE) {
      return res.status(403).json({ error: "এডমিন কোড ভুল" });
    }
    isAdmin = true;
  }

  try {
    await ensureAuthSchema();
    if (await getUserByEmail(mail)) {
      return res.status(409).json({ error: "এই ইমেইলে অ্যাকাউন্ট আছে — প্রবেশ করো" });
    }
    const display = await uniqueUsername((name || "").trim() || mail.split("@")[0]);
    const user = await createUserFull({
      username: display, email: mail, passwordHash: await hashPassword(pass), isAdmin,
    });
    await upsertProgress(user.id, {});

    const token = await signSession({ id: user.id, username: user.username, isAdmin: user.is_admin });
    setSessionCookie(res, token);
    return res.status(200).json({ username: user.username, isAdmin: user.is_admin, state: {} });
  } catch (e) {
    // ইউনিক ইনডেক্সে ধরা পড়লে (দুজন একসাথে খুললে) পরিষ্কার বার্তা দাও
    if (e && /unique|duplicate/i.test(e.message || "")) {
      return res.status(409).json({ error: "এই ইমেইলে অ্যাকাউন্ট আছে — প্রবেশ করো" });
    }
    return res.status(500).json({ error: "অ্যাকাউন্ট খোলা যায়নি — একটু পরে আবার চেষ্টা করো" });
  }
}
