import { saveState } from "./api.js";
import { NEW_OF_OLD } from "./data.js";

/* পাঠের ক্রম বদলালে সূচকও বদলায়। মুকুট (crowns) ও ভিজ্যুয়াল-অগ্রগতি সূচক ধরে
   রাখা হয়, তাই পুরনো ব্যবহারকারীর জন্য একবার সরিয়ে নেওয়া দরকার। সংস্করণ ধরে ধরে
   ধাপে ধাপে চলে — যে-কোনো পুরনো অবস্থা থেকে বর্তমানে পৌঁছানো যায়।

   V2: পুরনো এলোমেলো আইডি → বইয়ের ক্রমের অবস্থান।
   V3: দ্বিবচন পাঠ ৩৩ নম্বরে ঢোকানো — ৩৩+ অবস্থান এক ঘর পিছিয়ে যায়।
   V4: সরফ/বাব পাঠ ৩০ নম্বরে ঢোকানো — ৩০+ অবস্থান এক ঘর পিছিয়ে যায়।

   INSERTIONS-এ প্রতিটি সংস্করণে ঢোকানো পাঠের অবস্থান — সেই সময়ের ক্রম অনুযায়ী।
   পুরনো ব্যবহারকারীর জন্য সংস্করণ-ক্রমে একটার পর একটা shift প্রয়োগ হয়। */
export const ORDER_V = 4;
const INSERTIONS = [
  { atVersion: 3, pos: 33 }, // দ্বিবচন
  { atVersion: 4, pos: 30 }, // সরফ/বাব
];

function mapKeys(obj, fn) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const n = fn(k);
    if (n !== undefined && n !== null) out[n] = v;
  }
  return out;
}

export function migrateOrder(st) {
  if (!st) return;
  const v = st.orderV || 0;
  if (v >= ORDER_V) return;

  if (v < 2) {
    // V0/V1: মুকুট আসল লেসন-আইডিতে বাঁধা → NEW_OF_OLD দিয়ে সরাসরি চূড়ান্ত অবস্থানে
    // (NEW_OF_OLD ইতিমধ্যেই সব ঢোকানো পাঠসহ চূড়ান্ত ক্রম প্রতিফলিত করে)
    st.crowns = mapKeys(st.crowns, (k) => NEW_OF_OLD[k]);
    st.visualDone = mapKeys(st.visualDone, (k) => NEW_OF_OLD[k]);
  } else {
    // V2/V3: সেই সংস্করণের পরে যত পাঠ ঢুকেছে, প্রতিটির জন্য সংস্করণ-ক্রমে shift
    for (const ins of INSERTIONS) {
      if (v < ins.atVersion) {
        const shift = (k) => { const n = Number(k); return n >= ins.pos ? n + 1 : n; };
        st.crowns = mapKeys(st.crowns, shift);
        st.visualDone = mapKeys(st.visualDone, shift);
      }
    }
  }
  st.orderV = ORDER_V;
}

export const DEF={xp:0,gems:0,hearts:5,streak:0,bestStreak:0,lastDay:null,heartDay:null,
 crowns:{},words:{},wordSrs:{},badges:{},lessonsDone:0,perfect:0,chestCount:0,rivalXP:null,
 dayXP:0,goalDay:null,goal:30,storiesDone:{},introShown:false,briefShown:false,migNoticeShown:true,
 soundOn:true,visualDone:{},gender:null,wordStars:{},flashDone:0,orderV:4,fontScale:1};

// Mutable, module-live-bound globals shared across every screen — mirrors
// the original single-file app's top-level `S`/`CUR` variables.
export let S = null;
export let CUR = null;
export function setSession(state, username) { S = state; CUR = username; }

const LOCAL_CACHE_KEY = "eas_state_cache";
let saveTimer = null;

function mirrorToLocalCache() {
  if (!CUR) return;
  try { localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ username: CUR, state: S })); } catch { /* ignore quota errors */ }
}

// Optimistic local mirror (instant, synchronous) + debounced network sync so
// rapid-fire save() calls during a lesson collapse into one PUT /api/state.
export function save() {
  if (!CUR) return;
  mirrorToLocalCache();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveState(S).catch(() => { /* will retry on next save() */ }); }, 400);
}

/* opts.reset — ব্যবহারকারী নিজে সব মুছতে চাইলে; সার্ভারের ফাঁকা-state রক্ষাকবচ
   তখনই কেবল শিথিল হয়। */
export function flushSave(opts) {
  clearTimeout(saveTimer);
  if (!CUR) return;
  saveState(S, opts).catch(() => {});
}

window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSave(); });
window.addEventListener("beforeunload", flushSave);

export function readLocalCache() {
  try { return JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY)); } catch { return null; }
}
export function clearLocalCache() { localStorage.removeItem(LOCAL_CACHE_KEY); }

export function today() { return new Date().toISOString().slice(0, 10); }

export function dailyRefresh() {
  const t = today();
  if (S.heartDay !== t) { S.hearts = 5; S.heartDay = t; }
  if (S.goalDay !== t) { S.dayXP = 0; S.goalDay = t; }
  if (S.lastDay && S.lastDay !== t) {
    const d1 = new Date(S.lastDay), d2 = new Date(t);
    if ((d2 - d1) / 864e5 > 1) { S.streak = 0; } // streak broken
  }
  save();
}

export function bumpStreak() {
  const t = today();
  if (S.lastDay !== t) {
    const prev = S.lastDay; S.lastDay = t;
    if (prev && (new Date(t) - new Date(prev)) / 864e5 === 1) S.streak++; else S.streak = 1;
    if (S.streak > S.bestStreak) S.bestStreak = S.streak;
  }
  save();
}
