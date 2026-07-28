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

/* ════════ পুরনো (localStorage) প্রোফাইল থেকে নতুন অ্যাকাউন্টে একবার প্রগ্রেস আনার ব্রিজ ════════ */
const LEGACY_USERS_KEY = "eas_users";
function readLegacyState(name) {
  try {
    const users = JSON.parse(localStorage.getItem(LEGACY_USERS_KEY)) || {};
    return users[name]?.state || null;
  } catch { return null; }
}
function forgetLegacyUser(name) {
  try {
    const users = JSON.parse(localStorage.getItem(LEGACY_USERS_KEY)) || {};
    delete users[name];
    if (Object.keys(users).length) localStorage.setItem(LEGACY_USERS_KEY, JSON.stringify(users));
    else localStorage.removeItem(LEGACY_USERS_KEY);
  } catch { /* ignore */ }
}

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
async function doLogin() {
  const name = $("#li-name").value.trim();
  const pass = $("#li-pass").value;
  const wantAdmin = $("#li-admin-chk").checked;
  const code = $("#li-admin-code").value.trim();
  const err = $("#li-err"); err.style.display = "none";
  if (!name) { err.textContent = "নাম লেখো"; err.style.display = "block"; return; }

  // সার্ভার ধীর হলে (ঘুমন্ত ডাটাবেস) বোতামটি যেন মরা মনে না হয়
  const btn = document.querySelector("#scr-login .btn");
  const label = btn ? btn.textContent : "";
  if (btn) { btn.disabled = true; btn.textContent = "প্রবেশ করা হচ্ছে…"; }
  const done = () => { if (btn) { btn.disabled = false; btn.textContent = label; } };

  try {
    const res = await api.login({ username: name, password: pass });
    done(); await afterAuth(res);
    return;
  } catch (e) {
    // ইন্টারনেট/সার্ভারের সমস্যা হলে নতুন অ্যাকাউন্ট বানানোর চেষ্টা করা অর্থহীন
    if (e && e.offline) { done(); err.textContent = e.message; err.style.display = "block"; return; }
  }

  try {
    const legacyState = readLegacyState(name);
    const res = legacyState
      ? await api.migrate({ username: name, password: pass, wantsAdmin: wantAdmin, adminCode: code, localState: legacyState })
      : await api.signup({ username: name, password: pass, wantsAdmin: wantAdmin, adminCode: code });
    if (legacyState) forgetLegacyUser(name);
    done(); await afterAuth(res);
  } catch (e) {
    done();
    err.textContent = e.message || "লগইন ব্যর্থ হয়েছে";
    err.style.display = "block";
  }
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
function setGender(g) { S.gender = g; save(); nextIntro(); }
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
})();

/* ════════ ইনলাইন onclick="..." HTML অ্যাট্রিবিউট থেকে ডাকা ফাংশনগুলো window-এ এক্সপোজ করা ════════ */
Object.assign(window, {
  doLogin, doLogout, toggleSound, quitLesson, showTab, finishStory, resetAll,
  closeModal, tapUnit, storyLockedMsg, openVocabIntro, buyHearts, speak,
  vcTapTile, selOpt, tapMatch, tapTile, afterResult, startReview, startLesson, openStory, showRule, startSay, traceClear,
  nextIntro, setGender, showGenderAsk,
  startFlash, flipCard, flashKnown, flashAgain, quitFlash, skipEx, renderLeague,
  showLessonIndex, filterLessons,
  showGoalPicker, setGoal, showFontPicker, setFontScale, showGlossary, filterGlossary,
  showQuranProgress,
});
