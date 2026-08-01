import { getUserByUsername, getUserByEmail, getProgress, ensureAuthSchema } from "../../lib/db.js";
import { verifyPassword, signSession, setSessionCookie } from "../../lib/auth.js";

// Accepts either an email or the legacy username. Always returns the saved
// progress: the client seeds its session from this response, and previously
// (when `state` was missing) it fell back to a blank state and the next
// autosave overwrote the account's real progress with an empty one.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const { username, email, password } = req.body || {};
  const mail = (email || "").trim().toLowerCase();
  const name = (username || "").trim().slice(0, 24);
  if (!mail && !name) return res.status(400).json({ error: "নাম বা ইমেইল দিতে হবে" });

  let user = null;
  try {
    if (mail) { await ensureAuthSchema(); user = await getUserByEmail(mail); }
    else user = await getUserByUsername(name);
  } catch {
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে — একটু পরে আবার চেষ্টা করো" });
  }

  // notFound লাগানো থাকলে ক্লায়েন্ট বুঝতে পারে "নতুন অ্যাকাউন্ট খোলা যায়" —
  // আগে ভুল পাসওয়ার্ডেও অ্যাকাউন্ট খোলার চেষ্টা হতো, আর বার্তা আসত
  // "এই নামে ইতিমধ্যে একটি প্রোফাইল আছে", যা বিভ্রান্তিকর ছিল।
  if (!user) {
    return res.status(401).json({
      error: mail ? "এই ইমেইলে কোনো অ্যাকাউন্ট নেই" : "এই নামে কোনো প্রোফাইল নেই",
      notFound: true,
    });
  }

  if (!user.password_hash) {
    return res.status(401).json({ error: "এই অ্যাকাউন্টটি গুগল দিয়ে খোলা — “Google দিয়ে চালিয়ে যাও” চাপো" });
  }
  const ok = await verifyPassword(password || "", user.password_hash);
  if (!ok) return res.status(401).json({ error: "পাসওয়ার্ড ঠিক হয়নি" });

  const state = (await getProgress(user.id)) || {};
  const token = await signSession({ id: user.id, username: user.username, isAdmin: user.is_admin });
  setSessionCookie(res, token);
  return res.status(200).json({ username: user.username, isAdmin: user.is_admin, state });
}
