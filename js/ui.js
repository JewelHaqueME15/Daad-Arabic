import { $, esc, bn } from "./utils.js";
import { S, CUR, DEF, save, flushSave } from "./state.js";
import { UNITS, SECTIONS, STORIES, BADGES, LEVELS, totalCrowns, GLOSSARY } from "./data.js";
import { wordIcon, starsHTML } from "./icons.js";
import * as api from "./api.js";
import { updateSoundBtn } from "./tts.js";

export function updateTop() { $("#st-streak").textContent = S.streak; $("#st-gems").textContent = S.gems; $("#st-hearts").textContent = S.hearts; updateSoundBtn(); }
export function xpFloat(t) { const d = document.createElement("div"); d.className = "xp-float"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1100); }
export function comboFloat(t) { const d = document.createElement("div"); d.className = "combo-badge"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 950); }
export function celebrateConfetti() {
  const colors = ["#58cc02", "#1cb0f6", "#ffc800", "#ce82ff", "#ff4b4b", "#ff9600"];
  const wrap = document.createElement("div");
  wrap.className = "confetti-wrap";
  for (let i = 0; i < 46; i++) {
    const p = document.createElement("div");
    p.className = "confetti-piece";
    p.style.left = Math.random() * 100 + "%";
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (Math.random() * 0.4) + "s";
    p.style.animationDuration = (1.8 + Math.random() * 1.2) + "s";
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 3200);
}
export function modal(html, btns) { $("#modal-box").innerHTML = html + (btns || ""); $("#modal").classList.add("show"); }
export function closeModal() { $("#modal").classList.remove("show"); }

/* ════════ TABS ════════ */
export function showTab(t) {
  ["home", "words", "league", "profile"].forEach((x) => {
    $("#scr-" + x).classList.toggle("active", x === t);
    $("#tab-" + x).classList.toggle("on", x === t);
  });
  $("#scr-lesson").classList.remove("active"); $("#scr-result").classList.remove("active"); $("#scr-story").classList.remove("active"); $("#scr-vocab").classList.remove("active"); $("#scr-visual").classList.remove("active"); $("#scr-flash").classList.remove("active");
  $("#topbar").style.display = "flex"; $("#tabbar").style.display = "flex";
  if (t === "home") renderPath(); if (t === "words") renderWords();
  if (t === "league") renderLeague(); if (t === "profile") renderProfile();
}

/* ════════ HOME PATH ════════ */
export function unitState(i) {
  const c = S.crowns[i] || 0;
  if (c >= 3) return "done";
  if (i === 0) return "avail";
  return (S.crowns[i - 1] || 0) >= 1 ? "avail" : "locked";
}
const SEC_GRAD = ["linear-gradient(135deg,#58cc02,#3a9c00)", "linear-gradient(135deg,#1cb0f6,#0d84c4)", "linear-gradient(135deg,#ce82ff,#9a3fe0)", "linear-gradient(135deg,#ff9600,#e07200)"];
export function renderPath() {
  const p = $("#path");
  const gPct = Math.min(100, Math.round(S.dayXP / S.goal * 100));
  let h = `<div style="text-align:center;padding:4px 20px 0">
   <div style="font-size:13px;color:var(--gray);font-weight:700">📕 এসো আরবি শিখি · কিতাব ও ব্যাকরণ</div>
   <div style="font-size:16px;font-weight:800;margin-top:2px">ইলমের সফরে স্বাগতম, ${esc(CUR || "বন্ধু")}! 🌙</div>
   <div onclick="showGoalPicker()" style="margin:12px 16px 0;border:2px solid var(--line);border-radius:14px;padding:10px 14px;text-align:right;cursor:pointer">
     <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800">
       <span style="color:${gPct >= 100 ? "var(--green-d)" : "var(--gray)"}">${gPct >= 100 ? "🎯 লক্ষ্য অর্জিত! মাশাআল্লাহ" : "🎯 আজকের লক্ষ্য"} <span style="color:var(--blue);font-size:11px">✎</span></span>
       <span style="color:var(--gray)">⚡${Math.min(S.dayXP, S.goal)}/${S.goal} XP</span>
     </div>
     <div style="height:10px;background:var(--line);border-radius:6px;margin-top:6px;overflow:hidden">
       <div style="height:100%;width:${gPct}%;background:${gPct >= 100 ? "var(--green)" : "var(--gold)"};border-radius:6px;transition:width .4s"></div>
     </div>
   </div></div>`;
  // দ্রুত-চলাচল: পরের পাঠে চালিয়ে যাও + যেকোনো পাঠ খুঁজে জাম্প করো
  const next = nextLessonIdx();
  h += `<div style="padding:12px 16px 0;display:flex;gap:8px">
    ${next >= 0 ? `<button class="btn" style="flex:1" onclick="tapUnit(${next})">▶ চালিয়ে যাও — পাঠ ${bn(next + 1)}</button>` : ""}
    <button class="btn ghost" style="${next >= 0 ? "flex:0 0 54px;padding:14px 0" : "flex:1"}" onclick="showLessonIndex()">🔍${next >= 0 ? "" : " পাঠ খুঁজো"}</button>
  </div>`;
  // শেখা শব্দ যথেষ্ট হলে হোম থেকেই দ্রুত অনুশীলন — খুঁজতে হবে না
  const learnedCount = Object.keys(S.words).length;
  if (learnedCount >= 4) h += `<div style="padding:8px 16px 0"><button class="btn blue" onclick="startReview()">🔁 শেখা শব্দ অনুশীলন করো (${learnedCount}টি)</button></div>`;
  let lastPart = null;
  SECTIONS.forEach((sec, si) => {
    const done = UNITS.slice(sec.from, sec.to + 1).filter((u) => (S.crowns[u.id] || 0) > 0).length;
    const tot = sec.to - sec.from + 1;
    // খণ্ড বদলালে বড় করে খণ্ডের নাম — বইয়ের তিন খণ্ড স্পষ্ট বোঝা যায়
    if (sec.part !== lastPart) {
      lastPart = sec.part;
      h += `<div class="part-head"><span class="rule"></span><span class="pt">${sec.part}</span><span class="rule"></span></div>`;
    }
    h += `<div class="sec-head" style="background:${SEC_GRAD[si % SEC_GRAD.length]}">
      <div><div class="st">${sec.t}</div><div class="ss">${sec.s}</div></div>
      <div class="sc">${done}/${tot}</div>
    </div>`;
    UNITS.slice(sec.from, sec.to + 1).forEach((u, k) => {
      const i = u.id, st = unitState(i), c = S.crowns[i] || 0;
      const off = i % 4 === 1 ? "offset-l" : i % 4 === 3 ? "offset-r" : "";
      h += `<div class="unit-head"><h2><span class="un">${bn(i + 1)}</span>${u.title}</h2><p>${u.sub}</p></div>
      <div class="node-row"><div class="node-wrap ${off}">
        <button class="node ${st}" onclick="tapUnit(${i})">${st === "locked" ? "🔒" : st === "done" ? "🏆" : u.icon}
          ${c > 0 ? `<span class="crowns">👑${c}</span>` : ""}
        </button>
        <div class="node-label">${st === "done" ? "সম্পূর্ণ!" : st === "locked" ? "তালাবদ্ধ" : "শুরু করো"}</div>
      </div></div>`;
      const story = STORIES.find((s) => s.afterId === i);
      if (story) {
        const idx = STORIES.indexOf(story);
        const unlocked = S.isAdmin || (S.crowns[story.afterId] || 0) > 0;
        const doneS = S.storiesDone && S.storiesDone[story.id];
        h += `<div class="story-card ${unlocked ? "" : "locked"}" onclick="${unlocked ? `openStory(${idx})` : `storyLockedMsg()`}">
          <div class="emo">${doneS ? "✅" : story.icon}</div>
          <div class="txt"><div class="t">📖 গল্প · ${story.title}</div><div class="s">${unlocked ? story.sub : "আগে উপরের পাঠে ন্যূনতম ১টি মুকুট জেতো"}</div></div>
        </div>`;
      }
    });
  });
  h += `<div style="text-align:center;padding:10px;color:var(--gray);font-weight:700;font-size:13px">সম্পূর্ণ কিতাব (৩ খণ্ড) + সরফ · নাহু · বালাগাহ — আলহামদুলিল্লাহ 🤲</div>`;
  p.innerHTML = h;
}
/* পরবর্তী করণীয় পাঠ — যেটি খোলা কিন্তু এখনো সম্পূর্ণ হয়নি */
export function nextLessonIdx() {
  for (let i = 0; i < UNITS.length; i++) if (unitState(i) === "avail") return i;
  return -1;
}
/* ════════ পাঠ-সূচি ও খোঁজা ════════ */
export function lessonRows(q) {
  q = (q || "").trim().toLowerCase();
  let html = "", lastPart = null;
  SECTIONS.forEach((sec) => {
    const items = [];
    for (let i = sec.from; i <= sec.to; i++) {
      const u = UNITS[i];
      if (q && !(u.title + " " + u.sub).toLowerCase().includes(q)) continue;
      const st = unitState(i), c = S.crowns[i] || 0;
      const badge = c >= 3 ? "🏆" : c > 0 ? "👑" + c : st === "locked" ? "🔒" : "•";
      const locked = st === "locked" && !S.isAdmin;
      items.push(`<button class="li-row${locked ? " locked" : ""}" ${locked ? "disabled" : `onclick="closeModal();tapUnit(${i})"`}>
        <span class="li-no">${bn(i + 1)}</span><span class="li-t">${u.title}</span><span class="li-b">${badge}</span></button>`);
    }
    if (items.length) {
      if (sec.part !== lastPart) { lastPart = sec.part; html += `<div class="li-part">${sec.part}</div>`; }
      html += `<div class="li-sec">${sec.t}</div>` + items.join("");
    }
  });
  return html || `<div style="text-align:center;color:var(--gray);padding:24px;font-weight:700">কিছু পাওয়া যায়নি — অন্য শব্দে খোঁজো</div>`;
}
export function filterLessons(q) { const el = $("#li-list"); if (el) el.innerHTML = lessonRows(q); }

/* ════════ দৈনিক লক্ষ্য ════════ */
const GOAL_OPTIONS = [
  { v: 10, t: "আরামদায়ক", s: "১০ XP · দিনে ১টি পাঠ" },
  { v: 20, t: "সহজ", s: "২০ XP · রোজ একটু একটু" },
  { v: 30, t: "নিয়মিত", s: "৩০ XP · ভারসাম্যপূর্ণ" },
  { v: 50, t: "কঠোর", s: "৫০ XP · দ্রুত এগোও" },
];
export function setGoal(v) { S.goal = v; save(); closeModal(); showTab("home"); }
export function showGoalPicker() {
  modal(`<div class="emo">🎯</div><h2>দৈনিক লক্ষ্য বেছে নাও</h2>
    <p>প্রতিদিন কত XP অর্জনের চেষ্টা করবে?</p>
    <div class="opt-list">${GOAL_OPTIONS.map((g) => `<button class="opt-card${S.goal === g.v ? " on" : ""}" onclick="setGoal(${g.v})">
      <span class="oc-t">${g.t} — ⚡${g.v}</span><span class="oc-s">${g.s}</span></button>`).join("")}</div>`,
    `<button class="btn ghost" onclick="closeModal()">বন্ধ করো</button>`);
}

/* ════════ ফন্ট-সাইজ (অ্যাক্সেসিবিলিটি) ════════ */
const FONT_OPTIONS = [
  { v: 0.9, t: "ছোট" }, { v: 1, t: "স্বাভাবিক" }, { v: 1.15, t: "বড়" }, { v: 1.3, t: "আরও বড়" },
];
export function applyFontScale(v) {
  // zoom দিয়ে পুরো লেখা সমানুপাতে বড়/ছোট — px ফন্টেও কাজ করে, লেআউট ভাঙে না
  document.documentElement.style.zoom = v || 1;
}
export function setFontScale(v) { S.fontScale = v; save(); applyFontScale(v); showFontPicker(); }
export function showFontPicker() {
  modal(`<div class="emo">🔠</div><h2>লেখার আকার</h2>
    <p>চোখের আরামে যেটি ভালো লাগে বেছে নাও।</p>
    <div class="opt-list">${FONT_OPTIONS.map((f) => `<button class="opt-card${(S.fontScale || 1) === f.v ? " on" : ""}" onclick="setFontScale(${f.v})">
      <span class="oc-t" style="font-size:${15 * f.v}px">${f.t}</span><span class="oc-s">অ আ ك ت — ${Math.round(f.v * 100)}%</span></button>`).join("")}</div>`,
    `<button class="btn" onclick="closeModal()">ঠিক আছে</button>`);
}

/* ════════ ব্যাকরণ-পরিভাষা কোষ ════════ */
export function glossaryRows(q) {
  q = (q || "").trim().toLowerCase();
  let html = "";
  for (const cat of GLOSSARY) {
    const items = cat.terms.filter((tm) => !q || (tm.t + " " + tm.b + " " + tm.a).toLowerCase().includes(q));
    if (!items.length) continue;
    html += `<div class="gl-cat">${cat.name}</div>`;
    html += items.map((tm) => `<div class="gl-row">
      <div class="gl-head"><span class="ar gl-ar">${tm.a}</span><button class="gl-sp" onclick="speak('${tm.a.replace(/'/g, "\\'")}')">🔊</button><span class="gl-t">${tm.t}</span></div>
      <div class="gl-b">${tm.b}</div></div>`).join("");
  }
  return html || `<div style="text-align:center;color:var(--gray);padding:24px;font-weight:700">কিছু পাওয়া যায়নি</div>`;
}
export function filterGlossary(q) { const el = $("#gl-list"); if (el) el.innerHTML = glossaryRows(q); }
export function showGlossary() {
  modal(`<div class="emo">📚</div><h2>ব্যাকরণ-পরিভাষা কোষ</h2>
    <input id="gl-search" class="li-input" placeholder="পরিভাষা খুঁজো… (মাসদার, ই'রাব, তাশবীহ)" oninput="filterGlossary(this.value)" autocomplete="off">
    <div id="gl-list" class="li-list gl-list">${glossaryRows("")}</div>`,
    `<button class="btn ghost" onclick="closeModal()">বন্ধ করো</button>`);
  setTimeout(() => { const s = $("#gl-search"); if (s) s.focus(); }, 120);
}
export function showLessonIndex() {
  modal(`<div class="emo">🔍</div><h2>সব পাঠ · খুঁজে জাম্প করো</h2>
    <input id="li-search" class="li-input" placeholder="বিষয় বা নাম লিখো… (যেমন: ইদাফা, মাসদার, ই'রাব)" oninput="filterLessons(this.value)" autocomplete="off">
    <div id="li-list" class="li-list">${lessonRows("")}</div>`,
    `<button class="btn ghost" onclick="closeModal()">বন্ধ করো</button>`);
  setTimeout(() => { const s = $("#li-search"); if (s) s.focus(); }, 120);
}
export function storyLockedMsg() { modal(`<div class="emo">🔒</div><h2>গল্পটি এখনো তালাবদ্ধ</h2><p>এই গল্পের আগের পাঠে অন্তত ১টি মুকুট (👑) জিতলে গল্পটি খুলবে।</p>`, `<button class="btn blue" onclick="closeModal()">ঠিক আছে</button>`); }
export function tapUnit(i) {
  const st = unitState(i);
  if (st === "locked" && !S.isAdmin) { modal(`<div class="emo">🔒</div><h2>এখনো তালাবদ্ধ</h2><p>আগের পাঠে অন্তত ১টি মুকুট (👑) জিতলে এই পাঠ খুলবে।</p>`, `<button class="btn blue" onclick="closeModal()">ঠিক আছে</button>`); return; }
  if (S.hearts <= 0 && !S.isAdmin) { modal(`<div class="emo">💔</div><h2>হৃদয় শেষ!</h2><p>আগামীকাল হৃদয়গুলো আবার ভরে যাবে। অথবা ৩০ 💎 দিয়ে এখনই ভরে নাও।</p>`,
   `<button class="btn blue" onclick="buyHearts()">💎 ৩০ দিয়ে ভরো</button><div style="height:10px"></div><button class="btn ghost" onclick="closeModal()">পরে</button>`); return; }
  const u = UNITS[i], c = S.crowns[i] || 0;
  const adminNote = (st === "locked" && S.isAdmin) ? `<p style="color:var(--purple);font-weight:800">👑 এডমিন প্রিভিউ — তালাবদ্ধ পাঠ, তবু খোলা যাচ্ছে</p>` : "";
  modal(`<div class="emo">${u.icon}</div><h2>${u.title}</h2><p>${u.sub}<br>মুকুট: ${"👑".repeat(c) || "—"} (${c}/৩)</p>${adminNote}<div class="tipbox">${u.tip}</div>`,
   `<button class="btn" onclick="closeModal();openVocabIntro(${i})">শুরু করো +XP</button><div style="height:10px"></div><button class="btn ghost" onclick="closeModal()">বাতিল</button>`);
}
export function buyHearts() {
  if (S.gems >= 30) { S.gems -= 30; S.hearts = 5; save(); updateTop(); closeModal(); xpFloat("❤️❤️❤️❤️❤️"); }
  else { modal(`<div class="emo">💎</div><h2>যথেষ্ট রত্ন নেই</h2><p>পাঠ শেষ করে রত্ন জেতো!</p>`, `<button class="btn blue" onclick="closeModal()">ঠিক আছে</button>`); }
}

/* ════════ WORDS ════════ */
export function renderWords() {
  const list = $("#word-list"), ws = Object.entries(S.words);
  if (!ws.length) { list.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--gray);font-weight:700"><div style="font-size:52px;margin-bottom:10px">📖</div>এখনো কোনো শব্দ শেখোনি।<br>প্রথম পাঠ শুরু করো! 🌱</div>`; return; }
  const stars = S.wordStars || {};
  const mastered = ws.filter(([a]) => (stars[a] || 0) >= 3).length;
  const pct = Math.round((mastered / ws.length) * 100);
  list.innerHTML = `
    <div class="words-actions">
      <button class="wa-card" onclick="startFlash()"><span class="e">🃏</span><span class="t">ফ্ল্যাশকার্ড</span><span class="s">উল্টে উল্টে মুখস্থ</span></button>
      <button class="wa-card alt" onclick="startReview()"><span class="e">🔁</span><span class="t">অনুশীলন</span><span class="s">প্রশ্ন-উত্তরে ঝালাই</span></button>
    </div>
    <div class="words-stat">
      <div class="ws-row"><span>⭐ মুখস্থ হয়েছে</span><span><b>${mastered}</b> / ${ws.length}</span></div>
      <div class="ws-bar"><div style="width:${pct}%"></div></div>
    </div>`
   + ws.map(([a, b]) => {
     const n = stars[a] || 0, ico = wordIcon(a);
     return `<div class="word-row">
       <div class="w-ico">${ico}</div>
       <div class="w-main"><span class="ar">${a}</span><span class="bn">${b}</span></div>
       <div class="w-right"><span class="w-stars">${starsHTML(n)}</span><button onclick="speak('${a.replace(/'/g, "\\'")}')">🔊</button></div>
     </div>`;
   }).join("");
}
/* ════════ LEADERBOARD ════════ */
/* লিডারবোর্ড এখন আসল — সার্ভার থেকে সব ব্যবহারকারীর XP নিয়ে আসে। */
function paintLeague(rows, note) {
  $("#lb-list").innerHTML = rows.map((r, i) => `<div class="lb-row ${r.me ? "me" : ""}">
    <span class="rank">${i + 1}</span><span>${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "·"}</span>
    <span>${esc(r.n)}</span><span class="xps">${r.xp} XP</span></div>`).join("")
    + `<button class="btn ghost" style="margin-top:14px" onclick="renderLeague()">↻ তালিকা নতুন করে আনো</button>`
    + `<p style="color:var(--gray);font-size:12.5px;font-weight:600;margin-top:10px;text-align:center">${note}</p>`;
}
export async function renderLeague() {
  const list = $("#lb-list");
  if (!list.dataset.loaded) list.innerHTML = `<p style="text-align:center;color:var(--gray);font-weight:700;padding:24px 0">তালিকা আনা হচ্ছে…</p>`;
  try {
    const res = await api.leaderboard();
    const rows = (res.rows || []).map((r) => ({ n: r.username, xp: r.xp, me: r.username === res.me }));
    // নিজের XP সার্ভারে সেভ হওয়ার আগেই বদলাতে পারে — তাই নিজেরটা স্থানীয় মান দিয়ে দেখাও
    const mine = rows.find((r) => r.me);
    if (mine) mine.xp = Math.max(mine.xp, S.xp); else rows.push({ n: CUR || "তুমি", xp: S.xp, me: true });
    rows.sort((a, b) => b.xp - a.xp);
    list.dataset.loaded = "1";
    paintLeague(rows, "সব শিক্ষার্থীর আসল XP — পাঠ শেষ করলেই তালিকা বদলাবে।");
  } catch {
    // অফলাইন বা সার্ভার নেই — অন্তত নিজের অবস্থান দেখাও
    paintLeague([{ n: CUR || "তুমি", xp: S.xp, me: true }], "এখন সংযোগ নেই — শুধু তোমার XP দেখানো হচ্ছে।");
  }
}
/* ════════ PROFILE ════════ */
export function renderProfile() {
  const lvl = Math.min(LEVELS.length - 1, Math.floor(S.xp / 150));
  $("#pf-av").textContent = LEVELS[lvl].e;
  $("#pf-title").innerHTML = `${esc(CUR || "")}${S.isAdmin ? '<span class="admin-tag">👑 এডমিন</span>' : ""}<br><span style="font-size:15px;color:var(--gray)">${LEVELS[lvl].t}</span>`;
  $("#pf-sub").textContent = `লেভেল ${lvl + 1} · পরের লেভেলে ${150 - (S.xp % 150)} XP বাকি`;
  $("#pf-xp").textContent = S.xp; $("#pf-streak").textContent = S.streak + " 🔥";
  $("#pf-crowns").textContent = totalCrowns(S) + "/" + (UNITS.length * 3); $("#pf-words").textContent = Object.keys(S.words).length;
  $("#badge-grid").innerHTML = BADGES.map((b) => `<div class="badge ${S.badges[b.id] ? "" : "off"}"><div class="emo">${b.emo}</div><div class="nm">${b.nm}</div><div style="font-size:10.5px;color:var(--gray);font-weight:600">${b.desc}</div></div>`).join("");
  const wrap = $("#admin-panel-wrap");
  if (S.isAdmin) {
    const unitRows = UNITS.map((u) => `<div class="admin-row"><span class="an">${u.icon} ${u.title}</span><button onclick="startLesson(${u.id})">প্রিভিউ</button></div>`).join("");
    const storyRows = STORIES.map((s, idx) => `<div class="admin-row"><span class="an">📖 ${s.title}</span><button class="gold" onclick="openStory(${idx})">প্রিভিউ</button></div>`).join("");
    wrap.innerHTML = `<details class="admin-acc"><summary>🛠️ এডমিন প্যানেল — সব পাঠ ও গল্প যাচাই করো</summary>
      <p style="color:var(--gray);font-weight:600;font-size:13px;margin:8px 0">তালাবদ্ধ থাকলেও যেকোনো পাঠ/গল্প সরাসরি খুলে মান যাচাই করতে পারবে।</p>
      <div style="margin-top:6px">${unitRows}</div>
      <div style="margin-top:14px;font-weight:800;color:var(--purple)">📖 গল্পসমূহ</div>
      <div>${storyRows}</div>
    </details>`;
  } else { wrap.innerHTML = ""; }
}
export function resetAll() {
  if (confirm("সত্যিই সব প্রগ্রেস মুছে ফেলবে?")) {
    Object.assign(S, DEF, { introShown: true });
    flushSave();
    location.reload();
  }
}
