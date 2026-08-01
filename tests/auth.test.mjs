/* Regression tests for the login endpoints.
   The headline case: /api/auth/login once returned no `state`, so the client
   seeded a blank session and the next autosave overwrote the account's real
   progress with an empty one — every sign-in wiped the learner's progress.
   Run: npm test */
process.env.JWT_SECRET = "test-secret";
process.env.ADMIN_SIGNUP_CODE = "ARBI-USTAD-2026";

import { loadHandler, call, reporter } from "./load-handler.mjs";
import * as db from "./fake-db.mjs";

const login = await loadHandler("api/auth/login.js");
const signup = await loadHandler("api/auth/signup.js");
const register = await loadHandler("api/auth/register.js");
const migrate = await loadHandler("api/migrate.js");

const t = reporter("=== login must return saved progress (the data-loss bug) ===");

db.__reset();
await call(signup, { username: "রাশেদ", password: "pw123456" });
await db.upsertProgress(db.__users()[0].id, { xp: 950, streak: 12, crowns: { 0: 3 } });
let r = await call(login, { username: "রাশেদ", password: "pw123456" });
t.ok("login returns 200", r.code === 200);
t.ok("login returns state", !!r.body.state);
t.ok("state carries real xp", r.body.state && r.body.state.xp === 950);
t.ok("state carries crowns", r.body.state && r.body.state.crowns && r.body.state.crowns[0] === 3);
t.ok("sets session cookie", /session=/.test(r.headers["Set-Cookie"] || ""));

t.section("=== wrong password reports the password, not 'name taken' ===");
r = await call(login, { username: "রাশেদ", password: "WRONG" });
t.ok("wrong password -> 401", r.code === 401);
t.ok("message mentions the password", /পাসওয়ার্ড/.test(r.body.error));
t.ok("not flagged notFound, so no account is created", !r.body.notFound);

t.section("=== unknown name is flagged notFound (legacy new-name-new-profile) ===");
r = await call(login, { username: "একদমনতুন", password: "x" });
t.ok("unknown name -> 401 + notFound", r.code === 401 && r.body.notFound === true);
r = await call(login, { username: "রাশেদ ", password: "pw123456" });
t.ok("surrounding spaces are trimmed", r.code === 200);

t.section("=== signup and migrate return state too ===");
db.__reset();
r = await call(signup, { username: "নতুন", password: "pw123456" });
t.ok("signup returns a state object", r.code === 200 && !!r.body.state);
db.__reset();
r = await call(migrate, { username: "পুরনো", password: "pw", localState: { xp: 400, lessonsDone: 7 } });
t.ok("migrate returns the progress it just seeded", r.code === 200 && r.body.state && r.body.state.xp === 400);

t.section("=== email registration ===");
db.__reset();
r = await call(register, { email: "  Test@Example.COM ", password: "secret123" });
t.ok("normalises the email", r.code === 200);
t.ok("derives a display name", r.body.username === "test");
t.ok("duplicate email -> 409", (await call(register, { email: "test@example.com", password: "secret123" })).code === 409);
t.ok("invalid email -> 400", (await call(register, { email: "bad-email", password: "secret123" })).code === 400);
t.ok("short password -> 400", (await call(register, { email: "a@b.co", password: "123" })).code === 400);
t.ok("bad admin code -> 403", (await call(register, { email: "a@b.co", password: "secret123", wantsAdmin: true, adminCode: "nope" })).code === 403);

t.section("=== email login ===");
r = await call(login, { email: "TEST@example.com", password: "secret123" });
t.ok("is case-insensitive", r.code === 200);
t.ok("returns state", !!r.body.state);
r = await call(login, { email: "test@example.com", password: "bad" });
t.ok("wrong password -> 401 without notFound", r.code === 401 && !r.body.notFound);
r = await call(login, { email: "ghost@nowhere.com", password: "x" });
t.ok("unknown email -> notFound", r.code === 401 && r.body.notFound === true);

t.section("=== /api/state refuses to blank out real progress ===");
const state = await loadHandler("api/state.js");
db.__reset();
const u = await db.createUser("saver", "hash", false);
await db.upsertProgress(u.id, { xp: 800, lessonsDone: 9, crowns: { 0: 3 }, words: { a: "b" } });
// forge a valid session cookie for this user
const { signSession } = await import("../lib/auth.js");
const cookie = await signSession({ id: u.id, username: u.username, isAdmin: false });
const put = async (body) => {
  const res = { code: 0, body: null, headers: {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
  await state({ method: "PUT", body, cookies: { session: cookie } }, res);
  return res;
};
r = await put({ state: { xp: 0, lessonsDone: 0, crowns: {}, words: {} } });
t.ok("blank autosave over real progress -> 409", r.code === 409);
t.ok("stored progress untouched", (await db.getProgress(u.id)).xp === 800);
r = await put({ state: { xp: 0, lessonsDone: 0, crowns: {}, words: {} }, reset: true });
t.ok("explicit reset is allowed", r.code === 200);
t.ok("progress actually cleared on reset", (await db.getProgress(u.id)).xp === 0);
r = await put({ state: { xp: 25, lessonsDone: 1 } });
t.ok("normal save still works", r.code === 200);

t.section("=== a Google-only account has no password to guess ===");
db.__reset();
await db.createUserFull({ username: "gUser", email: "g@x.com", googleSub: "sub-1", passwordHash: null });
r = await call(login, { email: "g@x.com", password: "" });
t.ok("empty password is rejected", r.code === 401);
t.ok("points the user at Google", /গুগল/.test(r.body.error));

t.done();
