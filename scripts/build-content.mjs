/* content/ ফোল্ডারের JSON ফাইলগুলো পড়ে js/content.generated.js বানায়।
   অ্যাপ সরাসরি content/ পড়ে না — তাতে ৪০+ ফাইল নামানো লাগত এবং প্রথমবার খুলতে
   দেরি হতো। বদলে ডিপ্লয়ের সময় একবার জোড়া লেগে যায়, ফলে সম্পাদনা সহজ থাকে
   আর অ্যাপ আগের মতোই দ্রুত থাকে।

   চালাও:  npm run build:content     (ডিপ্লয়ে npm run build নিজেই চালায়)  */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "content");
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const fail = (m) => { console.error("✖ কন্টেন্ট ত্রুটি: " + m); process.exit(1); };

const book = readJSON(path.join(ROOT, "book.json"));
const iconsFile = readJSON(path.join(ROOT, "icons.json"));
const glossaryFile = fs.existsSync(path.join(ROOT, "glossary.json")) ? readJSON(path.join(ROOT, "glossary.json")) : { categories: [] };

/* ── পাঠ পড়া ও যাচাই ── */
const lessons = book.order.map((name) => {
  const file = path.join(ROOT, "lessons", name + ".json");
  if (!fs.existsSync(file)) fail(`book.json-এ "${name}" আছে কিন্তু ফাইলটি নেই: content/lessons/${name}.json`);
  const L = readJSON(file);
  if (typeof L.id !== "number") fail(`${name}: "id" (সংখ্যা) নেই`);
  if (!L.title) fail(`${name}: "title" নেই`);
  if (!Array.isArray(L.vocab) || !L.vocab.length) fail(`${name}: "vocab" খালি`);
  if (!Array.isArray(L.sents) || !L.sents.length) fail(`${name}: "sents" খালি`);
  L.vocab.forEach((v, i) => { if (!v.a || !v.b) fail(`${name}: vocab[${i}]-এ "a" বা "b" নেই`); });
  L.sents.forEach((s, i) => { if (!s.a || !s.b) fail(`${name}: sents[${i}]-এ "a" বা "b" নেই`); });
  (L.qa || []).forEach((q, i) => {
    if (!q.q || !Array.isArray(q.o) || typeof q.c !== "number") fail(`${name}: qa[${i}] অসম্পূর্ণ`);
    if (q.c < 0 || q.c >= q.o.length) fail(`${name}: qa[${i}]-এর সঠিক উত্তরের সূচক "c" সীমার বাইরে`);
  });
  (L.fill || []).forEach((q, i) => {
    if (!q.q || !Array.isArray(q.o) || typeof q.c !== "number") fail(`${name}: fill[${i}] অসম্পূর্ণ`);
    if (q.c < 0 || q.c >= q.o.length) fail(`${name}: fill[${i}]-এর "c" সীমার বাইরে`);
  });
  return { file: name, L };
});

const ids = lessons.map((x) => x.L.id);
if (new Set(ids).size !== ids.length) fail("দুটি পাঠে একই id আছে — প্রতিটি id আলাদা হতে হবে");

/* ── অধ্যায় যাচাই: ০..N-১ পুরোটা ঢাকতে হবে ── */
const covered = [];
book.sections.forEach((s) => { for (let i = s.from; i <= s.to; i++) covered.push(i); });
if (covered.length !== lessons.length || covered.some((v, i) => v !== i))
  fail(`book.json-এর sections মিলছে না — ০ থেকে ${lessons.length - 1} পর্যন্ত ঠিকভাবে ঢাকা নেই`);

/* ── গল্প ── */
const storyFiles = fs.readdirSync(path.join(ROOT, "stories")).filter((f) => f.endsWith(".json")).sort();
const stories = storyFiles.map((f) => {
  const S = readJSON(path.join(ROOT, "stories", f));
  if (!S.id || !S.title) fail(`stories/${f}: "id" বা "title" নেই`);
  if (!ids.includes(S.afterLessonId)) fail(`stories/${f}: afterLessonId=${S.afterLessonId} — এমন কোনো পাঠ নেই`);
  if (!Array.isArray(S.lines) || !S.lines.length) fail(`stories/${f}: "lines" খালি`);
  return { id: S.id, afterId: S.afterLessonId, icon: S.icon, title: S.title, sub: S.sub, lines: S.lines };
});

/* ── জোড়া লাগানো ── */
const RAW_UNITS = lessons.map(({ L }) => {
  const u = { id: L.id, icon: L.icon, title: L.title, sub: L.sub, tip: L.tip, vocab: L.vocab, sents: L.sents };
  if (L.qa) u.qa = L.qa;
  if (L.fill) u.fill = L.fill;
  if (L.noTaper) u.noTaper = true; // ব্যাকরণ পাঠ — হারাকাত পূর্ণ থাকে (i'rab দেখাতে হবে)
  return u;
});
const BOOK_ORDER = ids;
const LEARN = {};
lessons.forEach(({ L }) => { LEARN[L.id] = (L.learn || []).join("\n"); });

const out = `/* ⚠️ স্বয়ংক্রিয়ভাবে তৈরি — এই ফাইল হাতে এডিট করো না।
   কন্টেন্ট বদলাতে content/ ফোল্ডারের JSON ফাইল এডিট করো, তারপর:
     npm run build:content
   তৈরি হয়েছে: scripts/build-content.mjs */
export const RAW_UNITS = ${JSON.stringify(RAW_UNITS)};
export const BOOK_ORDER = ${JSON.stringify(BOOK_ORDER)};
export const SECTIONS = ${JSON.stringify(book.sections)};
export const RAW_STORIES = ${JSON.stringify(stories)};
export const LEARN = ${JSON.stringify(LEARN)};
export const ICONS = ${JSON.stringify(iconsFile.icons)};
export const GLOSSARY = ${JSON.stringify(glossaryFile.categories)};
`;
const target = path.join(process.cwd(), "js", "content.generated.js");

/* --check: শুধু মিলিয়ে দেখে (content/ এডিট করে rebuild করতে ভুলে গেলে ধরা পড়ে) */
if (process.argv.includes("--check")) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (current !== out) {
    console.error("✖ js/content.generated.js পুরনো হয়ে গেছে — content/ বদলেছে কিন্তু rebuild হয়নি।");
    console.error("  ঠিক করতে চালাও:  npm run build:content   (তারপর দুটো ফাইলই কমিট করো)");
    process.exit(1);
  }
  console.log("✓ কন্টেন্ট ও তৈরি-করা ফাইল মিলে গেছে");
  process.exit(0);
}

fs.writeFileSync(target, out);
console.log(`✓ ${RAW_UNITS.length} পাঠ, ${stories.length} গল্প, ${Object.keys(iconsFile.icons).length} আইকন → js/content.generated.js`);
