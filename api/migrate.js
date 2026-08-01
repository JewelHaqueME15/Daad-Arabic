import { getUserByUsername, createUser, upsertProgress } from "../lib/db.js";
import { hashPassword, signSession, setSessionCookie } from "../lib/auth.js";

// One-time endpoint for pre-existing users whose progress lives only in
// this browser's localStorage (from before real accounts existed). Same
// account-creation logic as signup, but seeds server-side progress from the
// posted local state instead of starting empty.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const { username, password, wantsAdmin, adminCode, localState } = req.body || {};
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
  const seeded = (localState && typeof localState === "object") ? localState : {};
  await upsertProgress(user.id, seeded);

  const token = await signSession({ id: user.id, username: user.username, isAdmin: user.is_admin });
  setSessionCookie(res, token);
  // সদ্য আনা প্রগ্রেসটাই ফেরত দাও — নইলে ক্লায়েন্ট ফাঁকা সেশন বানিয়ে
  // পরের অটো-সেভে এইমাত্র আনা অগ্রগতি মুছে দিত
  return res.status(200).json({ username: user.username, isAdmin: user.is_admin, state: seeded });
}
