/* ════════ স্পেসড রিপিটিশন (SRS) — শব্দ কবে আবার ঝালাই করতে হবে তার সূচি ════════
   S.words = { আরবি: বাংলা } শুধু "শেখা কি না" বলে; এখানে প্রতিটি শব্দের জন্য
   একটি হালকা SM-2/Leitner সূচি রাখা হয় S.wordSrs = { আরবি: {ease,iv,due,reps,lapses} }।
   - iv  : পরবর্তী ঝালাইয়ের ব্যবধান (দিনে)
   - due : কোন তারিখে (YYYY-MM-DD) আবার আসবে
   - ease: সহজতা-গুণক (ভুল করলে কমে, ঠিক করলে একটু বাড়ে)
   S.words থাকলেও srs না থাকলে শব্দটি "due" ধরা হয়, তাই পুরনো শব্দও ঝালাইয়ে আসে। */
import { S, save, today } from "./state.js";

function addDays(dateStr, n) {
  // UTC জুড়ে হিসাব রাখো — today() (state.js) UTC তারিখ দেয়, তাই স্থানীয় সময়ে
  // হিসাব করলে +৬ ঘণ্টা অঞ্চলে "কাল" ভুলবশত "আজ" হয়ে যেত।
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function map() { if (!S.wordSrs) S.wordSrs = {}; return S.wordSrs; }
function fresh() { return { ease: 2.5, iv: 0, due: today(), reps: 0, lapses: 0 }; }

/* নতুন শব্দ সূচিতে বসাও। justPracticed=true → পাঠে সঠিক উত্তরে শেখা (কাল আসবে),
   false → শুধু পরিচয় হয়েছে (আজই ঝালাই দরকার)। ইতিমধ্যে থাকলে বদলায় না। */
export function seedWord(a, justPracticed) {
  const m = map();
  if (m[a]) return;
  m[a] = justPracticed
    ? { ease: 2.5, iv: 1, due: addDays(today(), 1), reps: 1, lapses: 0 }
    : fresh();
}

/* ঝালাইয়ের ফল অনুযায়ী পরবর্তী সূচি হিসাব করো। */
export function scheduleWord(a, good) {
  const m = map();
  const e = m[a] || fresh();
  if (good) {
    e.reps = (e.reps || 0) + 1;
    if (e.reps === 1) e.iv = 1;
    else if (e.reps === 2) e.iv = 3;
    else e.iv = Math.max(1, Math.round((e.iv || 1) * (e.ease || 2.5)));
    e.ease = Math.min(2.8, (e.ease || 2.5) + 0.06);
  } else {
    e.reps = 0;
    e.lapses = (e.lapses || 0) + 1;
    e.iv = 1;
    e.ease = Math.max(1.3, (e.ease || 2.5) - 0.2);
  }
  e.due = addDays(today(), e.iv);
  m[a] = e;
  save();
}

/* আজ ঝালাইয়ের জন্য প্রস্তুত শব্দ (সূচিহীন পুরনো শব্দও ধরা হয়)। */
export function dueWords() {
  const t = today(), m = map(), out = [];
  for (const a of Object.keys(S.words || {})) {
    const e = m[a];
    if (!e || (e.due || t) <= t) out.push({ a, b: S.words[a] });
  }
  return out;
}
export function dueCount() { return dueWords().length; }

/* একবারের মাইগ্রেশন: SRS চালুর আগে যাদের অনেক শব্দ শেখা ছিল, তাদের সব শব্দ
   একসাথে "due" হয়ে দেয়াল না বানিয়ে আগামী সপ্তাহে ছড়িয়ে দাও। */
export function migrateSrs() {
  const m = map();
  const keys = Object.keys(S.words || {});
  if (Object.keys(m).length === 0 && keys.length > 6) {
    keys.forEach((a, i) => {
      m[a] = { ease: 2.5, iv: 3, due: addDays(today(), i % 7), reps: 2, lapses: 0 };
    });
    save();
  }
}
