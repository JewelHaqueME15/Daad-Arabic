import { sql } from "@vercel/postgres";

/* ── ইমেইল ও গুগল লগইনের জন্য দরকারি কলামগুলো একবার নিশ্চিত করো ──
   পুরনো ডাটাবেসে (001_init.sql) email/google_sub কলাম নেই। প্রতিটি ALTER
   idempotent, আর ফলাফল মনে রাখা হয় — তাই কোল্ড স্টার্টে একবারই চলে। */
let schemaReady = null;
export function ensureAuthSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT`;
    // গুগল-ব্যবহারকারীর কোনো পাসওয়ার্ড থাকে না
    await sql`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email)) WHERE email IS NOT NULL`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx ON users (google_sub) WHERE google_sub IS NOT NULL`;
  })().catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

const USER_COLS = "id, username, email, google_sub, password_hash, is_admin";

/* নাম মেলানো: আগে হুবহু, না পেলে ছোট-বড় হাতের অক্ষর উপেক্ষা করে।
   (আগে শুধু হুবহু মিলত, তাই "Rashed" ও "rashed" আলাদা প্রোফাইল হয়ে যেত।) */
export async function getUserByUsername(username) {
  const exact = await sql`SELECT id, username, password_hash, is_admin FROM users WHERE username = ${username}`;
  if (exact.rows[0]) return exact.rows[0];
  const ci = await sql`SELECT id, username, password_hash, is_admin FROM users WHERE lower(username) = lower(${username}) ORDER BY id LIMIT 1`;
  return ci.rows[0] || null;
}

export async function getUserByEmail(email) {
  const { rows } = await sql`SELECT id, username, email, google_sub, password_hash, is_admin FROM users WHERE lower(email) = lower(${email}) LIMIT 1`;
  return rows[0] || null;
}

export async function getUserByGoogleSub(sub) {
  const { rows } = await sql`SELECT id, username, email, google_sub, password_hash, is_admin FROM users WHERE google_sub = ${sub} LIMIT 1`;
  return rows[0] || null;
}

export async function getUserById(id) {
  const { rows } = await sql`SELECT id, username, password_hash, is_admin FROM users WHERE id = ${id}`;
  return rows[0] || null;
}

export async function createUser(username, passwordHash, isAdmin) {
  const { rows } = await sql`
    INSERT INTO users (username, password_hash, is_admin)
    VALUES (${username}, ${passwordHash}, ${isAdmin})
    RETURNING id, username, is_admin
  `;
  return rows[0];
}

/* ইমেইল বা গুগল অ্যাকাউন্ট তৈরি (পাসওয়ার্ড ঐচ্ছিক — গুগলে থাকে না) */
export async function createUserFull({ username, email, googleSub, passwordHash, isAdmin }) {
  const { rows } = await sql`
    INSERT INTO users (username, email, google_sub, password_hash, is_admin)
    VALUES (${username}, ${email || null}, ${googleSub || null}, ${passwordHash || null}, ${!!isAdmin})
    RETURNING id, username, email, google_sub, is_admin
  `;
  return rows[0];
}

/* একই ইমেইলে আগে পাসওয়ার্ড-অ্যাকাউন্ট থাকলে গুগল অ্যাকাউন্টটি তার সাথেই জুড়ে দাও */
export async function linkGoogleSub(userId, sub, email) {
  const { rows } = await sql`
    UPDATE users SET google_sub = ${sub}, email = COALESCE(email, ${email || null})
    WHERE id = ${userId}
    RETURNING id, username, email, google_sub, is_admin
  `;
  return rows[0];
}

/* নাম দখল হয়ে থাকলে পাশে সংখ্যা বসিয়ে ফাঁকা নাম খুঁজে নাও (গুগল সাইন-ইনে
   ব্যবহারকারী নাম বাছে না, তাই সংঘর্ষ এড়াতে দরকার) */
export async function uniqueUsername(base) {
  const clean = (base || "").trim().slice(0, 20) || "শিক্ষার্থী";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? clean : `${clean}${i + 1}`;
    const { rows } = await sql`SELECT 1 FROM users WHERE lower(username) = lower(${candidate}) LIMIT 1`;
    if (!rows.length) return candidate;
  }
  return `${clean}${Date.now().toString().slice(-5)}`;
}

export async function getProgress(userId) {
  const { rows } = await sql`SELECT state FROM progress WHERE user_id = ${userId}`;
  return rows[0]?.state ?? null;
}

/* লিডারবোর্ড: সব আসল ব্যবহারকারীর XP অনুযায়ী তালিকা।
   XP প্রগ্রেসের JSONB blob-এ থাকে, তাই সেখান থেকেই বের করা হয়। */
export async function getLeaderboard(limit = 25) {
  const { rows } = await sql`
    SELECT u.username,
           COALESCE(NULLIF(p.state->>'xp', '')::numeric, 0)::int AS xp,
           COALESCE(NULLIF(p.state->>'streak', '')::numeric, 0)::int AS streak
    FROM users u
    LEFT JOIN progress p ON p.user_id = u.id
    ORDER BY xp DESC, u.username ASC
    LIMIT ${limit}
  `;
  return rows;
}

export async function upsertProgress(userId, state) {
  await sql`
    INSERT INTO progress (user_id, state, updated_at)
    VALUES (${userId}, ${JSON.stringify(state)}::jsonb, now())
    ON CONFLICT (user_id)
    DO UPDATE SET state = ${JSON.stringify(state)}::jsonb, updated_at = now()
  `;
}
