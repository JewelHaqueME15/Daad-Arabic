export const $ = (s) => document.querySelector(s);
export function esc(t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function pick(arr, n, not) {
  const p = shuffle(arr.filter((x) => x !== not));
  return p.slice(0, n);
}
// Extra decoy tiles for word-bank sentence-building exercises — words drawn
// from `pool` that aren't already part of the correct answer.
export function pickExtra(pool, excludeArr, n) {
  const exclude = new Set(excludeArr);
  const candidates = shuffle(pool.filter((w) => !exclude.has(w)));
  return candidates.slice(0, n);
}

/* ════════ তাশকীল (হারাকাত) ধীরে ধীরে কমানো ════════
   কিতাবটিও ঠিক এভাবেই এগোয় — শুরুতে পূর্ণ যের-যবর-পেশ, মাঝে শেষ হরফের ই'রাব
   তুলে দেওয়া, আর শেষ খণ্ডে প্রায় খালি লেখা। এখানে কেবল *দেখানোর* সময় কমানো হয়;
   মূল লেখা অক্ষত থাকে — তাই উত্তর মেলানো ও উচ্চারণ (TTS) আগের মতোই নির্ভুল।
   তাশদীদ (ّ) কখনো তোলা হয় না — ওটা না থাকলে পড়াই বদলে যায়। */
/* ইংরেজি সংখ্যা → বাংলা সংখ্যা (১, ২, ৩ …) */
export function bn(n) { return String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]); }

/* উচ্চারণ মেলানোর জন্য আরবি স্বাভাবিকীকরণ — হারাকাত, তাশদীদ, হামযা/আলিফ/ইয়া/তা-মারবুতার
   ভিন্নতা উপেক্ষা করা হয়, যাতে শিক্ষার্থীর সামান্য ভিন্ন উচ্চারণও গ্রহণ করা যায়। */
export function normAr(s) {
  return String(s || "")
    .replace(/[ً-١ّـٰٓ]/g, "")     // হারাকাত, তাশদীদ, তাতভীল
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ء/g, "")
    .replace(/ال/g, "")            // "আল" থাকুক বা না থাকুক
    .replace(/[^ء-ي]/g, "")
    .trim();
}
export function levenshtein(a, b) {
  a = a || ""; b = b || "";
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
/* উচ্চারণ-যাচাই: চেনা টেক্সটের যেকোনো বিকল্পের সাথে যথেষ্ট মিল থাকলেই সঠিক */
export function sayMatches(heardList, target) {
  const t = normAr(target);
  if (!t) return false;
  const tol = Math.max(1, Math.floor(t.length * 0.34));
  return (heardList || []).some((h) => {
    const x = normAr(h);
    if (!x) return false;
    return x === t || x.includes(t) || t.includes(x) || levenshtein(x, t) <= tol;
  });
}
export function tashkeelLevel(ui) { return ui >= 33 ? 2 : ui >= 19 ? 1 : 0; }
export function tk(text, level) {
  if (!text || !level) return text;
  const s = String(text);
  // স্তর ১: শুধু শব্দের শেষের ই'রাব/তানভীন ওঠে, ভেতরের হারাকাত থাকে
  if (level === 1) return s.replace(/[ً-ِْ]+(?=[\s،؟.,!?]|$)/g, "");
  // স্তর ২: খঞ্জর-আলিফসহ সব হারাকাত ওঠে (তাশদীদ ছাড়া)
  return s.replace(/[ً-ِْٰ]/g, "");
}
