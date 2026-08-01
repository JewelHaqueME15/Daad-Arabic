import { $ } from "./utils.js";
import { S, DEF, setSession, dailyRefresh, save, migrateOrder } from "./state.js";
import * as api from "./api.js";
import { showTab, tapUnit, buyHearts, storyLockedMsg, resetAll, modal, closeModal, updateTop, renderLeague, showLessonIndex, filterLessons, showGoalPicker, setGoal, showFontPicker, setFontScale, applyFontScale, showGlossary, filterGlossary, showQuranProgress } from "./ui.js";
import { migrateSrs } from "./srs.js";
import { startLesson, startReview, openVocabIntro, selOpt, tapMatch, tapTile, quitLesson, afterResult, showRule, skipEx, startSay, traceClear } from "./lesson.js";
import { openStory, finishStory } from "./stories.js";
import { vcTapTile } from "./visual.js";
import { startFlash, flipCard, flashKnown, flashAgain, quitFlash } from "./flash.js";
import { speak, toggleSound } from "./tts.js";

/* ════════ লগইন / প্রোফাইল ════════ */
async function afterAuth({ username, isAdmin, state }) {
  // পাঠের ক্রম বদলেছে — DEF মেশানোর আগেই পুরনো state-টিকে নতুন ক্রমে সরিয়ে নাও
  // (DEF-এ orderV আছে, তাই আগে মেশালে পুরনো state আর চেনা যেত না)
  const raw = state || {};
  migrateOrder(raw);
  setSession(Object.assign({}, DEF, raw), username);
  S.isAdmin = !!isAdmin;
  // লগইন ফর্মে লিঙ্গ বেছে নিলে (এবং আগে সংরক্ষিত না থাকলে) সেটি কাজে লাগাও
  const g = document.querySelector('input[name="li-gender"]:checked');
  if (g && !S.gender) { S.gender = g.value; save(); }
  enterApp();
}
/* ════════ প্রবেশ / নতুন অ্যাকাউন্ট ════════
   দুটি উপায়ই যথেষ্ট — গুগল, অথবা ইমেইল+পাসওয়ার্ড। (পুরনো নাম-প্রোফাইলের
   ব্যবহারকারীরা যেন আটকে না যান, তার জন্য নিচে ছোট একটি লিঙ্ক আছে।) */
let AUTH_MODE = "signin"; // signin | signup
function setAuthMode(m) {
  AUTH_MODE = m;
  const up = m === "signup";
  $("#fld-name").style.display = up ? "" : "none";
  $("#admin-row").style.display = up ? "" : "none";
  $("#pw-hint").style.display = up ? "" : "none";
  $("#li-go").textContent = up ? "অ্যাকাউন্ট খুলো →" : "প্রবেশ করো →";
  $("#li-epass").setAttribute("autocomplete", up ? "new-password" : "current-password");
  $("#li-sub").textContent = up
    ? "নতুন অ্যাকাউন্ট খুলে শুরু করো — অগ্রগতি সব ডিভাইসে থাকবে।"
    : "প্রবেশ করে শেখা শুরু করো — তোমার অগ্রগতি নিরাপদে সংরক্ষিত থাকবে।";
  $("#li-switch").innerHTML = up
    ? `অ্যাকাউন্ট আছে? <button type="button" class="linkish" onclick="setAuthMode('signin')">প্রবেশ করো</button>`
    : `অ্যাকাউন্ট নেই? <button type="button" class="linkish" onclick="setAuthMode('signup')">নতুন খুলো</button>`;
  const err = $("#li-err"); if (err) err.style.display = "none";
}
/* পাসওয়ার্ড দেখা/লুকানো — ভুল টাইপ ঠেকাতে সাহায্য করে */
function togglePw() {
  const i = $("#li-epass"), b = $("#pw-eye");
  const show = i.type === "password";
  i.type = show ? "text" : "password";
  b.textContent = show ? "🙈" : "👁️";
}
function loginErr(msg) { const e = $("#li-err"); e.textContent = msg; e.style.display = "block"; }
/* সার্ভার ধীর হলে (ঘুমন্ত ডাটাবেস) বোতামটি যেন মরা মনে না হয় */
function busyBtn(btn, on, busyText) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.dataset.label || btn.textContent; btn.disabled = true; btn.textContent = busyText; }
  else { btn.disabled = false; if (btn.dataset.label) btn.textContent = btn.dataset.label; }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function submitAuth() {
  const err = $("#li-err"); err.style.display = "none";
  const btn = $("#li-go");
  const email = $("#li-email").value.trim();
  const pass = $("#li-epass").value;
  const fail = (m) => { busyBtn(btn, false); loginErr(m); };

  if (!email) return loginErr("ইমেইল লেখো");
  if (!EMAIL_RE.test(email)) return loginErr("ইমেইলটি ঠিকঠাক লেখা হয়নি");
  if (!pass) return loginErr("পাসওয়ার্ড লেখো");

  if (AUTH_MODE === "signup") {
    if (pass.length < 6) return loginErr("পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে");
    busyBtn(btn, true, "অ্যাকাউন্ট খোলা হচ্ছে…");
    try {
      const res = await api.register({
        email, password: pass,
        name: $("#li-dispname").value.trim(),
        wantsAdmin: $("#li-admin-chk").checked, adminCode: $("#li-admin-code").value.trim(),
      });
      busyBtn(btn, false); await afterAuth(res);
    } catch (e) {
      // ইমেইলটি আগে থেকেই থাকলে প্রবেশের দিকে নিয়ে যাও
      if (e && e.status === 409) { setAuthMode("signin"); return fail("এই ইমেইলে অ্যাকাউন্ট আছে — পাসওয়ার্ড দিয়ে প্রবেশ করো"); }
      fail(e.message || "অ্যাকাউন্ট খোলা যায়নি");
    }
    return;
  }

  busyBtn(btn, true, "প্রবেশ করা হচ্ছে…");
  try {
    const res = await api.login({ email, password: pass });
    busyBtn(btn, false); await afterAuth(res);
  } catch (e) {
    // অ্যাকাউন্ট না থাকলে সরাসরি "নতুন খোলা"-তে নিয়ে যাও, খালি ভুল দেখিও না
    if (e && e.notFound) { setAuthMode("signup"); return fail("এই ইমেইলে অ্যাকাউন্ট নেই — নিচের বোতামে নতুন খুলে ফেলো"); }
    fail(e.message || "প্রবেশ করা যায়নি");
  }
}


/* ════════ গুগল সাইন-ইন ════════ */
async function onGoogleCredential(resp) {
  const err = $("#li-err"); err.style.display = "none";
  try {
    const res = await api.googleLogin(resp && resp.credential);
    await afterAuth(res);
  } catch (e) {
    loginErr(e.message || "গুগল দিয়ে প্রবেশ করা যায়নি");
  }
}
async function initGoogle() {
  let cfg = null;
  try { cfg = await api.config(); } catch { return; }          // সার্ভার না থাকলে চুপচাপ বাদ
  if (!cfg || !cfg.googleClientId) return;                      // কনফিগার না হলে বোতাম দেখিও না
  try {
    await new Promise((res, rej) => {
      if (window.google && window.google.accounts) return res();
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true; s.defer = true; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  } catch { return; }
  if (!(window.google && window.google.accounts && window.google.accounts.id)) return;
  window.google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: onGoogleCredential });
  window.google.accounts.id.renderButton($("#g-btn"), {
    theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 280,
  });
  $("#g-wrap").style.display = "";
}
async function doLogout() {
  try { await api.logout(); } catch { /* clear client state regardless */ }
  location.reload();
}
/* শুরুর মডালগুলো একটার পর একটা দেখানোর সারি (একসাথে দেখালে একটা আরেকটাকে ঢেকে দিত) */
let introQueue = [];
function nextIntro() {
  const f = introQueue.shift();
  if (f) f(); else closeModal();
}
function setGender(g) {
  S.gender = g; save();
  nextIntro();
  // বাছাই করা কণ্ঠটি সঙ্গে সঙ্গে শুনিয়ে দাও — তাতে বোঝা যায় সেটিংটি কাজ করেছে
  setTimeout(() => speak("بِسْمِ اللّٰهِ"), 250);
}
function showGenderAsk() {
  modal(`<div class="emo">🗣️</div><h2>কণ্ঠস্বর বেছে নাও</h2>
  <p>তুমি ছেলে না মেয়ে? সেই অনুযায়ী আরবি উচ্চারণের কণ্ঠস্বর বাছাই করা হবে — ছেলেদের জন্য পুরুষকণ্ঠ, মেয়েদের জন্য নারীকণ্ঠ।<br><br>পরে প্রোফাইল থেকে যেকোনো সময় বদলাতে পারবে।</p>`,
    `<button class="btn" onclick="setGender('male')">👦 ছেলে</button><div style="height:10px"></div><button class="btn blue" onclick="setGender('female')">👧 মেয়ে</button>`);
}
function showMigNotice() {
  modal(`<div class="emo">🎊</div><h2>স্বাগতম ফিরে!</h2><p>তোমার আগের সব অগ্রগতি অক্ষত আছে, এখন নিরাপদে সার্ভারে সংরক্ষিত হচ্ছে।</p>`, `<button class="btn" onclick="nextIntro()">আলহামদুলিল্লাহ — চালিয়ে যাই!</button>`);
}
function showBrief() {
    modal(`<div class="emo ar">ض</div><h2>Daad — আরবি শেখো!</h2>
    <p>খেলার ছলে ধাপে ধাপে আরবি শেখো! শব্দ ও নিয়ম শিখে তুমি ইনশাআল্লাহ কুরআন-হাদীসের সহজ আরবি বুঝতে শিখবে।</p>
    <div class="brief-box">
      <p class="bh">📋 শুরুর আগে যা জানা থাকা চাই</p>
      <ul>
        <li>আরবি <b>হরফ</b> চিনতে ও পড়তে পারা</li>
        <li><b>যের-যবর-পেশ</b> (হারাকাত) দেখে সঠিক উচ্চারণ করতে পারা</li>
        <li>হরফ জোড়া লাগিয়ে ছোট শব্দ পড়তে পারা</li>
      </ul>
      <p class="note">এগুলো এখনও ভালো না পারলে আগে <b>কায়দা / নূরানী</b> শেষ করে নাও — তাহলে এই অ্যাপ অনেক সহজ লাগবে। ইনশাআল্লাহ!</p>
    </div>
    <div class="brief-box">
      <p class="bh">🎮 অ্যাপটি যেভাবে চলে</p>
      <ul>
        <li>প্রতি পাঠের শুরুতে <b>নিয়ম ও নতুন শব্দ</b> বুঝে নাও, তারপর অনুশীলন</li>
        <li>অনুশীলন <b>সহজ থেকে কঠিন</b> — শুরুতে ছবি দেখে সহজ প্রশ্ন</li>
        <li>প্রতিদিন খেলে <b>🔥 ধারা</b>, সঠিক উত্তরে <b>⚡XP</b> ও <b>💎 রত্ন</b></li>
        <li>ভুল হলে <b>❤️ হৃদয়</b> কমবে; <b>👑 মুকুট</b> জিতে পরের পাঠ খোলে</li>
        <li>অধ্যায় শেষে <b>📜 গল্প</b> পড়ে মজায় মজায় অনুশীলন</li>
      </ul>
    </div>`,
    `<button class="btn" onclick="nextIntro()">বিসমিল্লাহ — শুরু করি!</button>`);
}
function enterApp() {
  $("#scr-login").classList.remove("active");
  $("#topbar").style.display = "flex"; $("#tabbar").style.display = "flex";
  applyFontScale(S.fontScale || 1); // সংরক্ষিত লেখার-আকার ফিরিয়ে আনো
  migrateSrs(); // SRS চালুর আগের শেখা শব্দগুলোকে সূচিতে ছড়িয়ে দাও (একবার)
  dailyRefresh(); updateTop(); showTab("home");
  introQueue = [];
  if (!S.briefShown) { S.briefShown = true; S.introShown = true; save(); introQueue.push(showBrief); }
  else if (!S.migNoticeShown) { S.migNoticeShown = true; save(); introQueue.push(showMigNotice); }
  if (!S.gender) introQueue.push(showGenderAsk); // লগইনে না দিলে এখানে একবার জিজ্ঞেস করো
  nextIntro();
}

/* ════════ ইনিশিয়াল বুট ════════ */
(async function boot() {
  try {
    const res = await api.me();
    await afterAuth(res);
    return;
  } catch { /* not signed in yet */ }
  $("#scr-login").classList.add("active");
  setAuthMode("signin");
  initGoogle();
  // Enter চাপলেই ফর্ম জমা হোক — ছোট স্ক্রিনে সুবিধা
  ["#li-email", "#li-epass", "#li-dispname"].forEach((sel) => {
    const el = $(sel);
    if (el) el.addEventListener("keydown", (ev) => { if (ev.key === "Enter") submitAuth(); });
  });
})();

/* ════════ ইনলাইন onclick="..." HTML অ্যাট্রিবিউট থেকে ডাকা ফাংশনগুলো window-এ এক্সপোজ করা ════════ */
Object.assign(window, {
  submitAuth, setAuthMode, togglePw, doLogout, toggleSound, quitLesson, showTab, finishStory, resetAll,
  closeModal, tapUnit, storyLockedMsg, openVocabIntro, buyHearts, speak,
  vcTapTile, selOpt, tapMatch, tapTile, afterResult, startReview, startLesson, openStory, showRule, startSay, traceClear,
  nextIntro, setGender, showGenderAsk,
  startFlash, flipCard, flashKnown, flashAgain, quitFlash, skipEx, renderLeague,
  showLessonIndex, filterLessons,
  showGoalPicker, setGoal, showFontPicker, setFontScale, showGlossary, filterGlossary,
  showQuranProgress,
});
