/* Loads an /api handler with its lib imports redirected to in-memory fakes, so
   the real handler logic can be exercised without a Postgres connection or a
   round-trip to Google. The rewritten copy is written to the OS temp dir and
   imported by absolute URL, so nothing lands in the repo. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const url = (p) => pathToFileURL(path.resolve(here, p)).href;

const REAL_AUTH = url("../lib/auth.js");
const FAKE_DB = url("./fake-db.mjs");
const FAKE_AUTH = url("./fake-auth.mjs");

export async function loadHandler(relPath, { fakeAuth = false } = {}) {
  const abs = path.resolve(here, "..", relPath);
  const src = fs.readFileSync(abs, "utf8")
    .replace(/from "(?:\.\.\/)+lib\/db\.js"/g, `from "${FAKE_DB}"`)
    .replace(/from "(?:\.\.\/)+lib\/auth\.js"/g, `from "${fakeAuth ? FAKE_AUTH : REAL_AUTH}"`);
  const out = path.join(os.tmpdir(), `daad-${path.basename(relPath)}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(out, src);
  const mod = await import(pathToFileURL(out).href);
  try { fs.unlinkSync(out); } catch { /* best effort */ }
  return mod.default;
}

/* Minimal stand-in for the Vercel response object. */
export function mkRes() {
  const r = { code: 0, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}
export async function call(handler, body, method = "POST") {
  const res = mkRes();
  await handler({ method, body }, res);
  return res;
}

export function reporter(title) {
  let pass = 0, fail = 0;
  console.log(title);
  return {
    ok(name, cond) { if (cond) { pass++; console.log("  ok   " + name); } else { fail++; console.log("  FAIL " + name); } },
    section(t) { console.log("\n" + t); },
    done() {
      console.log("\n" + (fail ? `${fail} FAILED of ${pass + fail}` : `all ${pass} passed`));
      process.exit(fail ? 1 : 0);
    },
  };
}
