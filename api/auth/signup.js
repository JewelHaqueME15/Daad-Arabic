import { getUserByUsername, createUser, upsertProgress } from "../../lib/db.js";
import { hashPassword, signSession, setSessionCookie } from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const { username, password, wantsAdmin, adminCode } = req.body || {};
  const name = (username || "").trim().slice(0, 24);
  if (!name) return res.status(400).json({ error: "নাম দিতে হবে" });

  const existing = await getUserByUsername(name);
  if (existing) return res.status(409).json({ error: "এই নামে ইতিমধ্যে একটি প্রোফাইল আছে" });

  let isAdmin = false;
  if (wantsAdmin) {
    if (!adminCode || adminCode !== process.env.ADMIN_SIGNUP_CODE) {
      return res.status(403).json({ error: "এডমিন কোড ভুল" });
    }
    isAdmin = true;
  }

  const passwordHash = await hashPassword(password || "");
  const user = await createUser(name, passwordHash, isAdmin);
  await upsertProgress(user.id, {});

  const token = await signSession({ id: user.id, username: user.username, isAdmin: user.is_admin });
  setSessionCookie(res, token);
  // state ফেরত দেওয়া জরুরি — ক্লায়েন্ট এখান থেকেই সেশন সাজায়
  return res.status(200).json({ username: user.username, isAdmin: user.is_admin, state: {} });
}
