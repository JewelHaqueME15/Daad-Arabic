// In-memory stand-in for lib/db.js so the handlers can be exercised without Postgres.
let users = [], progress = new Map(), nextId = 1;
export function __reset() { users = []; progress = new Map(); nextId = 1; }
export function __users() { return users; }
export async function ensureAuthSchema() {}
export async function getUserByUsername(u) {
  return users.find(x => x.username === u) || users.find(x => (x.username||"").toLowerCase() === (u||"").toLowerCase()) || null;
}
export async function getUserByEmail(e) { return users.find(x => (x.email||"").toLowerCase() === (e||"").toLowerCase()) || null; }
export async function getUserByGoogleSub(s) { return users.find(x => x.google_sub === s) || null; }
export async function getUserById(id) { return users.find(x => x.id === id) || null; }
export async function createUser(username, passwordHash, isAdmin) {
  const u = { id: nextId++, username, email: null, google_sub: null, password_hash: passwordHash, is_admin: !!isAdmin };
  users.push(u); return u;
}
export async function createUserFull({ username, email, googleSub, passwordHash, isAdmin }) {
  if (email && users.some(x => (x.email||"").toLowerCase() === email.toLowerCase())) { const e = new Error("duplicate key value unique"); throw e; }
  const u = { id: nextId++, username, email: email||null, google_sub: googleSub||null, password_hash: passwordHash||null, is_admin: !!isAdmin };
  users.push(u); return u;
}
export async function linkGoogleSub(id, sub, email) {
  const u = users.find(x => x.id === id); u.google_sub = sub; u.email = u.email || email || null; return u;
}
export async function uniqueUsername(base) {
  const clean = (base||"").trim().slice(0,20) || "শিক্ষার্থী";
  for (let i=0;i<50;i++){ const c = i===0?clean:`${clean}${i+1}`; if (!users.some(x=>(x.username||"").toLowerCase()===c.toLowerCase())) return c; }
  return clean+Date.now();
}
export async function getProgress(id) { return progress.has(id) ? progress.get(id) : null; }
export async function upsertProgress(id, st) { progress.set(id, st); }
export async function getLeaderboard() { return []; }
