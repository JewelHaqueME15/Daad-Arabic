/* Regression tests for Google Sign-In account mapping.
   Google's token verification is stubbed (tests/fake-auth.mjs) so the
   find-link-or-create logic can be checked without contacting Google.
   Run: npm test */
process.env.JWT_SECRET = "test-secret";

import { loadHandler, call, reporter } from "./load-handler.mjs";
import * as db from "./fake-db.mjs";
import * as auth from "./fake-auth.mjs";

const google = await loadHandler("api/auth/google.js", { fakeAuth: true });
const t = reporter("=== first Google sign-in creates an account ===");

db.__reset();
auth.__setClaims({ sub: "google-123", email: "amina@gmail.com", email_verified: true, name: "Amina" });
let r = await call(google, { credential: "tok" });
t.ok("returns 200", r.code === 200);
t.ok("uses the Google display name", r.body.username === "Amina");
t.ok("returns a state object", !!r.body.state);
t.ok("sets session cookie", /session=/.test(r.headers["Set-Cookie"] || ""));
t.ok("exactly one account created", db.__users().length === 1);

t.section("=== signing in again reuses the account ===");
r = await call(google, { credential: "tok" });
t.ok("still one account", db.__users().length === 1);
t.ok("same username", r.body.username === "Amina");
await db.upsertProgress(db.__users()[0].id, { xp: 777, streak: 4 });
r = await call(google, { credential: "tok" });
t.ok("progress survives sign-out/sign-in", r.body.state && r.body.state.xp === 777);

t.section("=== Google links to an existing email account ===");
db.__reset();
await db.createUserFull({ username: "রাশেদ", email: "rashed@gmail.com", passwordHash: "hash" });
await db.upsertProgress(db.__users()[0].id, { xp: 1200 });
auth.__setClaims({ sub: "google-999", email: "rashed@gmail.com", email_verified: true, name: "Rashed" });
r = await call(google, { credential: "tok" });
t.ok("no duplicate account", db.__users().length === 1);
t.ok("keeps the original username", r.body.username === "রাশেদ");
t.ok("keeps the original progress", r.body.state && r.body.state.xp === 1200);
t.ok("links google_sub", db.__users()[0].google_sub === "google-999");

t.section("=== an unverified email must not take over an account ===");
db.__reset();
await db.createUserFull({ username: "victim", email: "victim@gmail.com", passwordHash: "hash" });
auth.__setClaims({ sub: "attacker-1", email: "victim@gmail.com", email_verified: false, name: "Attacker" });
r = await call(google, { credential: "tok" });
t.ok("did not link to the existing account", db.__users().length === 2);
t.ok("got a separate account", r.body.username !== "victim");
t.ok("did not attach the unverified email", db.__users()[1].email === null);

t.section("=== failure paths ===");
t.ok("invalid token -> 401", (await call(google, { credential: "BAD" })).code === 401);
t.ok("missing credential -> 400", (await call(google, {})).code === 400);
auth.__setClientId("");
r = await call(google, { credential: "tok" });
t.ok("unconfigured client id -> 503 with a clear message", r.code === 503 && /GOOGLE_CLIENT_ID/.test(r.body.error));

t.done();
