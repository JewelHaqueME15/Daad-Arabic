import { $, esc, shuffle, pick, pickExtra, tk, tashkeelLevel, normAr, sayMatches } from "./utils.js";
import { speechSupported, listenArabic } from "./speech.js";
import { S, save, bumpStreak } from "./state.js";
import { seedWord, scheduleWord, dueWords } from "./srs.js";
import { UNITS, BADGES, LEVELS } from "./data.js";
import { LEARN } from "./lessons.js";
import { ICONS } from "./icons.js";
import { modal, closeModal, showTab, updateTop, xpFloat, comboFloat, celebrateConfetti } from "./ui.js";
import { speak, sndOk, sndBad, sndPair, stopSpeech } from "./tts.js";
import { maybeVisualChallenge } from "./visual.js";

export let L = null; // চলমান পাঠ

/* অনুশীলনের সহজ → কঠিন ক্রম। শুরুতে ছবিভিত্তিক সহজ প্রশ্ন (চিনে নাও),
   মাঝে শব্দ বাছাই, শেষে অনুবাদ ও বাক্য গঠন (নিজে বানাও)। shuffle() একই
   স্তরের ভেতরে বৈচিত্র্য দেয়, আর Array.sort স্থিতিশীল হওয়ায় সামগ্রিক
   সহজ→কঠিন ঢালটা সবসময় বজায় থাকে। */
const DIFFICULTY = {
  pic_mc: 1, pic_match: 1, pic_ba: 2, listen_pic: 3,
  trace: 4, match: 4, mc_ab: 5,
  mc_ba: 6, listen: 7, say: 8,
  fill: 9, tr: 10, qa: 11,
  build: 12, build_ba: 13,
};
function orderByDifficulty(ex) {
  return shuffle(ex).sort((a, b) => (DIFFICULTY[a.t] || 6) - (DIFFICULTY[b.t] || 6));
}

/* Picture questions must never show the same icon twice — otherwise two options
   look equally correct and the question is unanswerable. Different words often
   share an icon (a pen / the pen / pens are all 🖊️), so filtering by word alone
   isn't enough; these filter by icon. */
function pickDistinctIcons(pool) {
  const seen = new Set(), out = [];
  for (const v of shuffle(pool)) {
    if (seen.has(v.img)) continue;
    seen.add(v.img); out.push(v);
  }
  return out;
}
function picDistractors(pool, answer, n) {
  return pickDistinctIcons(pool.filter((v) => v.img !== answer.img)).slice(0, n);
}

export function genExercises(ui) {
  const u = UNITS[ui], ex = [];
  const vocab = shuffle(u.vocab).slice(0, 8);
  const allV = UNITS.slice(0, ui + 1).flatMap((x) => x.vocab);
  vocab.slice(0, 3).forEach((w) => ex.push({ t: "mc_ab", w, opts: shuffle([w.b, ...pick(allV.map((v) => v.b), 3, w.b)]) }));
  vocab.slice(3, 5).forEach((w) => ex.push({ t: "mc_ba", w, opts: shuffle([w.a, ...pick(allV.map((v) => v.a), 3, w.a)]) }));
  vocab.slice(5, 7).forEach((w) => ex.push({ t: "listen", w, opts: shuffle([w.a, ...pick(allV.map((v) => v.a), 3, w.a)]) }));
  ex.push({ t: "match", pairs: shuffle(u.vocab).slice(0, 4) });
  const bnPool = [...new Set([...u.vocab.flatMap((v) => v.b.split(" ")), ...u.sents.flatMap((x) => x.b.split(" "))])];
  shuffle(u.sents).slice(0, 2).forEach((s) => {
    const words = s.a.split(" ");
    const distractors = pickExtra(u.vocab.map((v) => v.a), words, 1 + Math.floor(Math.random() * 2));
    ex.push({ t: "build", s, distractors });
  });
  shuffle(u.sents).slice(0, 2).forEach((s) => ex.push({ t: "tr", s, opts: shuffle([s.b, ...pick(u.sents.map((x) => x.b), 3, s.b)]) }));
  // অনুবাদ থেকে আরবি বাক্য সাজানোর বিপরীত: আরবি বাক্য দেখে অনুবাদ সাজাও
  shuffle(u.sents).slice(0, 2).forEach((s) => {
    const words = s.b.split(" ");
    const distractors = pickExtra(bnPool, words, 1 + Math.floor(Math.random() * 2));
    ex.push({ t: "build_ba", s, distractors });
  });
  if (u.qa) shuffle(u.qa).slice(0, 2).forEach((item) => ex.push({ t: "qa", q: item.q, opts: shuffle(item.o.slice()), ans: item.o[item.c] }));
  if (u.fill) shuffle(u.fill).slice(0, 2).forEach((item) => ex.push({ t: "fill", q: item.q, opts: shuffle(item.o.slice()), ans: item.o[item.c] }));
  const picVocab = pickDistinctIcons(u.vocab.filter((v) => v.img));
  const allVimg = allV.filter((v) => v.img);
  picVocab.slice(0, 2).forEach((w) => ex.push({ t: "pic_mc", w, opts: shuffle([w.a, ...picDistractors(allVimg, w, 3).map((v) => v.a)]) }));
  picVocab.slice(2, 4).forEach((w) => ex.push({ t: "pic_ba", w, opts: shuffle([w, ...picDistractors(allVimg, w, 3)]) }));
  picVocab.slice(4, 6).forEach((w) => ex.push({ t: "listen_pic", w, opts: shuffle([w, ...picDistractors(allVimg, w, 3)]) }));
  if (picVocab.length >= 4) ex.push({ t: "pic_match", pairs: picVocab.slice(0, 4) });
  // চার ভাষা-দক্ষতাই অনুশীলনে রাখতে প্রতি পাঠে একাধিক বলা (say) ও লেখা (trace)।
  // এক-শব্দের (স্পেসহীন) শব্দ থেকে বাছাই — শোনা+বলা ও হাতে লেখা।
  const single = shuffle(u.vocab.filter((v) => !/\s/.test(v.a) && normAr(v.a).length >= 2));
  const sayPicks = single.slice(0, 2);                                                  // বলো — দুটি কণ্ঠ যাচাই
  if (speechSupported()) sayPicks.forEach((w) => ex.push({ t: "say", w }));
  // লেখার জন্য ছোট শব্দ (≤৬ হরফ) ভালো; সম্ভব হলে বলা-শব্দের বাইরে থেকে দুটি ভিন্ন শব্দ
  const sayset = new Set(sayPicks.map((v) => v.a));
  const short = single.filter((v) => normAr(v.a).length <= 6);
  const outside = short.filter((v) => !sayset.has(v.a));
  const tracePicks = (outside.length >= 2 ? outside : short.length ? short : single).slice(0, 2);
  tracePicks.forEach((w) => ex.push({ t: "trace", w }));                                 // লেখো — দুটি ট্রেসিং
  return orderByDifficulty(ex);
}
/* রিভিউ: শেখা শব্দ থেকে মিশ্র অনুশীলন */
export function genReviewExercises(ws) {
  const ex = [], pool = shuffle(ws);
  const take = Math.min(10, pool.length);
  for (let i = 0; i < take; i++) {
    const w = pool[i], r = i % 3;
    if (r === 0) ex.push({ t: "mc_ab", w, opts: shuffle([w.b, ...pick(ws.map((v) => v.b), 3, w.b)]) });
    else if (r === 1) ex.push({ t: "mc_ba", w, opts: shuffle([w.a, ...pick(ws.map((v) => v.a), 3, w.a)]) });
    else ex.push({ t: "listen", w, opts: shuffle([w.a, ...pick(ws.map((v) => v.a), 3, w.a)]) });
  }
  if (ws.length >= 4) ex.push({ t: "match", pairs: shuffle(ws).slice(0, 4) });
  return orderByDifficulty(ex);
}
export function startReview() {
  const known = Object.entries(S.words).map(([a, b]) => ({ a, b }));
  if (known.length < 4) { modal(`<div class="emo">🌱</div><h2>আরেকটু শেখো!</h2><p>অন্তত ৪টি শব্দ শিখলে অনুশীলন খুলবে। আগে কয়েকটি পাঠ শেষ করো।</p>`, `<button class="btn blue" onclick="closeModal()">ঠিক আছে</button>`); return; }
  if (S.hearts <= 0) { modal(`<div class="emo">💔</div><h2>হৃদয় শেষ!</h2><p>আগামীকাল হৃদয়গুলো আবার ভরে যাবে।</p>`, `<button class="btn ghost" onclick="closeModal()">পরে</button>`); return; }
  // আজ ঝালাইয়ের জন্য প্রস্তুত (due) শব্দ আগে; ৬টির কম হলে বাকি শেখা শব্দ দিয়ে ভরাও
  let pool = dueWords();
  if (pool.length < 6) {
    const extra = shuffle(known.filter((w) => !pool.some((d) => d.a === w.a)));
    pool = pool.concat(extra).slice(0, Math.min(known.length, Math.max(10, pool.length)));
  }
  L = { ui: -1, review: true, ex: genReviewExercises(pool), i: 0, wrong: 0, correctWords: new Set(), combo: 0, maxCombo: 0 };
  ["home", "words", "league", "profile"].forEach((x) => $("#scr-" + x).classList.remove("active"));
  $("#scr-result").classList.remove("active"); $("#scr-story").classList.remove("active"); $("#scr-vocab").classList.remove("active"); $("#scr-visual").classList.remove("active");
  $("#topbar").style.display = "none"; $("#tabbar").style.display = "none";
  $("#scr-lesson").classList.add("active");
  renderEx();
}
export function startLesson(ui) {
  L = { ui, ex: genExercises(ui), i: 0, wrong: 0, correctWords: new Set(), combo: 0, maxCombo: 0 };
  $("#scr-home").classList.remove("active"); $("#scr-result").classList.remove("active"); $("#scr-story").classList.remove("active"); $("#scr-vocab").classList.remove("active"); $("#scr-visual").classList.remove("active");
  $("#topbar").style.display = "none"; $("#tabbar").style.display = "none";
  $("#scr-lesson").classList.add("active");
  renderEx();
}
/* ════════ শব্দ-পরিচিতি স্ক্রীন (বইয়ের মতো) ════════ */
export function openVocabIntro(ui) {
  const u = UNITS[ui], lvl = levelFor(ui);
  ["home", "words", "league", "profile"].forEach((x) => $("#scr-" + x).classList.remove("active"));
  $("#scr-lesson").classList.remove("active"); $("#scr-result").classList.remove("active"); $("#scr-story").classList.remove("active"); $("#scr-visual").classList.remove("active");
  $("#topbar").style.display = "none"; $("#tabbar").style.display = "none";
  $("#vocab-top .ttl").textContent = u.title;
  $("#vocab-body").innerHTML = `<div class="vocab-head"><h1>${u.title}</h1>
    <p style="color:var(--gray);font-weight:600;font-size:13px;margin-top:4px">${u.sub}</p></div>
    <div class="learn-card">
      <div class="learn-h">নিয়ম ও ব্যাখ্যা <span>আরবিতে চাপলে উচ্চারণ</span></div>
      <div class="tipbox learn-tip">${LEARN[u.oldId] || u.tip}</div>
    </div>
    <div class="vocab-section-h">নতুন শব্দ <span>🔊 চাপলে উচ্চারণ</span></div>
    <div class="vocab-table">
      <div class="vocab-row vocab-hrow"><div class="vocab-bn">অর্থ</div><div class="vocab-pic">ছবি</div><div class="vocab-ar">শব্দ</div></div>
      ${u.vocab.map((v) => `<div class="vocab-row">
      <div class="vocab-bn">${v.b}</div>
      <div class="vocab-pic">${v.img || ICONS[v.a] || ""}</div>
      <div class="vocab-ar"><button class="vocab-sp" onclick="speak('${v.a.replace(/'/g, "\\'")}')">🔊</button><span>${tk(v.a, lvl)}</span></div>
    </div>`).join("")}</div>`;
  // ব্যাখ্যার আরবি উদাহরণে চাপলে উচ্চারণ শোনা যায় — নতুন শিক্ষার্থীর জন্য সহায়ক
  $("#vocab-body").querySelectorAll(".learn-tip .ar").forEach((el) => {
    el.classList.add("tap-ar");
    el.onclick = () => speak(el.textContent.trim());
  });
  $("#vocab-start-btn").onclick = () => startLesson(ui);
  $("#scr-vocab").classList.add("active");
  window.scrollTo(0, 0);
}

export function quitLesson() {
  if (confirm("পাঠ ছেড়ে দিলে এই অগ্রগতি হারাবে। ছাড়বে?")) { stopSpeech(); showTab("home"); }
}
/* পাঠ চলাকালীন নিয়ম-ব্যাখ্যা আবার দেখা — নতুন শিক্ষার্থী ভুলে গেলে যেন ফিরে দেখতে পারে */
export function showRule() {
  if (!L || L.ui == null || L.ui < 0) return;
  const u = UNITS[L.ui];
  modal(`<div class="emo">📘</div><h2>${u.title}</h2>
    <div class="tipbox learn-tip" style="text-align:left;margin-top:6px">${LEARN[u.oldId] || u.tip}</div>`,
    `<button class="btn blue" onclick="closeModal()">বুঝেছি, চালিয়ে যাই</button>`);
  document.querySelectorAll("#modal-box .learn-tip .ar").forEach((el) => { el.classList.add("tap-ar"); el.onclick = () => speak(el.textContent.trim()); });
}
export function setProgress() { $("#pbar>div").style.width = (L.i / L.ex.length * 100) + "%"; $("#lesson-hearts").textContent = "❤️" + S.hearts; }
/* ── রেন্ডার ── */
/* তাশকীল স্তর — ব্যাকরণ পাঠে (noTaper) সবসময় পূর্ণ হারাকাত, নইলে বইয়ের ঢাল */
function levelFor(ui) { const u = UNITS[ui]; return (u && u.noTaper) ? 0 : tashkeelLevel(ui); }

export function renderEx() {
  const e = L.ex[L.i]; setProgress();
  // নিয়ম-দেখার বোতাম শুধু সাধারণ পাঠে (রিভিউতে একক পাঠ নেই, তাই লুকানো)
  const rb = $("#lesson-rule"); if (rb) rb.style.display = (L.ui != null && L.ui >= 0) ? "" : "none";
  const A = $("#ex-area");
  A.classList.remove("ex-anim"); void A.offsetWidth; A.classList.add("ex-anim");
  $("#check-bar").className = ""; $("#fb-text").textContent = "";
  const cb = $("#btn-check"); cb.disabled = true; cb.textContent = "যাচাই করো"; cb.onclick = checkAnswer;
  const sk = $("#btn-skip"); if (sk) sk.classList.remove("hide"); // নতুন প্রশ্নে আবার দেখাও
  L.sel = null; L.matchDone = 0; L.matchSel = null; L.built = []; L.answered = false;
  // বইয়ের মতো ধাপে ধাপে হারাকাত কমে — শুধু দেখানোর সময়, মেলানো/উচ্চারণে নয়
  const lvl = levelFor(L.ui); L.tkLvl = lvl;
  if (e.t === "mc_ab") {
    A.innerHTML = `<div class="ex-title">এই শব্দের অর্থ কী?</div>
    <div class="speak-row"><button class="speak-btn" onclick="speak('${e.w.a}')">🔊</button><span class="ar" style="font-size:40px">${tk(e.w.a,lvl)}</span></div>
    <div class="opts">${e.opts.map((o, i) => `<button class="opt" data-i="${i}" onclick="selOpt(this,'${esc(o)}')">${o}</button>`).join("")}</div>`;
    setTimeout(() => speak(e.w.a), 300);
  } else if (e.t === "mc_ba") {
    A.innerHTML = `<div class="ex-title">আরবিতে কোনটি?</div>
    <div class="big-bn">${e.w.b}</div>
    <div class="opts">${e.opts.map((o, i) => `<button class="opt" data-i="${i}" onclick="selOpt(this,'${esc(o)}')"><span class="ar">${tk(o,lvl)}</span></button>`).join("")}</div>`;
  } else if (e.t === "listen") {
    A.innerHTML = `<div class="ex-title">যা শুনছ সেটি বাছাই করো</div>
    <div class="speak-row"><button class="speak-btn" style="width:70px;height:70px;font-size:32px" onclick="speak('${e.w.a}')">🔊</button></div>
    <div class="opts grid2">${e.opts.map((o, i) => `<button class="opt" data-i="${i}" onclick="selOpt(this,'${esc(o)}')"><span class="ar">${tk(o,lvl)}</span></button>`).join("")}</div>
    <p style="text-align:center;color:var(--gray);font-weight:600;font-size:13px;margin-top:14px">শুনতে না পেলে 🔊 বোতামটি আবার চাপো</p>`;
    setTimeout(() => speak(e.w.a), 350);
  } else if (e.t === "tr") {
    A.innerHTML = `<div class="ex-title">বাক্যটির অর্থ কী?</div>
    <div class="speak-row"><button class="speak-btn" onclick="speak('${e.s.a}')">🔊</button></div>
    <div class="big-ar" style="font-size:28px;line-height:2">${tk(e.s.a,lvl)}</div>
    <div class="opts">${e.opts.map((o, i) => `<button class="opt" style="font-size:16px" data-i="${i}" onclick="selOpt(this,'${esc(o)}')">${o}</button>`).join("")}</div>`;
    setTimeout(() => speak(e.s.a), 300);
  } else if (e.t === "qa") {
    A.innerHTML = `<div class="ex-title">প্রশ্নের সঠিক উত্তরটি বাছাই করো</div>
    <div class="big-ar" style="font-size:26px;line-height:2">${tk(e.q,lvl)} <button class="speak-btn" style="width:42px;height:42px;font-size:19px;vertical-align:middle" onclick="speak('${e.q.replace(/\(.*?\)/g, "").trim()}')">🔊</button></div>
    <div class="opts">${e.opts.map((o, i) => `<button class="opt" data-i="${i}" onclick="selOpt(this,'${esc(o)}')"><span class="ar" style="font-size:21px">${tk(o,lvl)}</span></button>`).join("")}</div>`;
  } else if (e.t === "fill") {
    A.innerHTML = `<div class="ex-title">শূন্যস্থানে সঠিক শব্দটি বসাও</div>
    <div class="big-ar" style="font-size:30px;line-height:2">${tk(e.q,lvl)}</div>
    <div class="opts grid2">${e.opts.map((o, i) => `<button class="opt" data-i="${i}" onclick="selOpt(this,'${esc(o)}')"><span class="ar">${tk(o,lvl)}</span></button>`).join("")}</div>`;
  } else if (e.t === "say") {
    A.innerHTML = `<div class="ex-title">যা শুনছ, সেটি নিজে বলো 🎤</div>
    <div class="speak-row"><button class="speak-btn" style="width:64px;height:64px;font-size:30px" onclick="speak('${e.w.a.replace(/'/g, "\\'")}')">🔊</button></div>
    <div class="say-word ar">${tk(e.w.a, lvl)}</div>
    <div class="say-mic"><button id="say-btn" class="btn blue" onclick="startSay()">🎤 চাপো ও বলো</button></div>
    <div id="say-fb" class="say-fb"></div>
    <p style="text-align:center;color:var(--gray);font-weight:600;font-size:12.5px;margin-top:6px">শুদ্ধ হলে এগিয়ে যাবে · না পারলে নিচে “এড়িয়ে যাও”</p>`;
    setTimeout(() => speak(e.w.a), 300);
  } else if (e.t === "trace") {
    A.innerHTML = `<div class="ex-title">অক্ষরের উপর আঙুল বুলিয়ে লেখো ✍️</div>
    <div class="speak-row"><button class="speak-btn" onclick="speak('${e.w.a.replace(/'/g, "\\'")}')">🔊</button><span class="ar" style="font-size:26px">${tk(e.w.a, lvl)}</span></div>
    <div class="trace-hint"><span class="ar-dir">← ডান থেকে বাম</span></div>
    <div id="trace-wrap" class="trace-wrap"><canvas id="trace-cv"></canvas><span class="trace-start">● শুরু</span></div>
    <div class="trace-actions"><button class="btn ghost" onclick="traceClear()">↺ মুছে ফেলো</button></div>
    <div id="trace-fb" class="say-fb"></div>`;
    setTimeout(() => initTrace(e.w.a, lvl), 60);
  } else if (e.t === "pic_mc") {
    A.innerHTML = `<div class="ex-title">এটি কী? (ছবি দেখে আরবি শব্দ বাছাই করো)</div>
    <div class="pic-emo">${e.w.img}</div>
    <div class="opts grid2">${e.opts.map((o, i) => `<button class="opt" data-i="${i}" onclick="selOpt(this,'${esc(o)}')"><span class="ar">${tk(o,lvl)}</span></button>`).join("")}</div>`;
  } else if (e.t === "pic_ba") {
    A.innerHTML = `<div class="ex-title">কোন ছবিটি এই শব্দের অর্থ?</div>
    <div class="speak-row"><button class="speak-btn" onclick="speak('${e.w.a}')">🔊</button><span class="ar" style="font-size:36px">${tk(e.w.a,lvl)}</span></div>
    <div class="opts grid2">${e.opts.map((o, i) => `<button class="opt" data-i="${i}" onclick="selOpt(this,'${esc(o.a)}')"><span style="font-size:44px">${o.img}</span></button>`).join("")}</div>`;
    setTimeout(() => speak(e.w.a), 300);
  } else if (e.t === "listen_pic") {
    A.innerHTML = `<div class="ex-title">শব্দটি শুনে সঠিক ছবি বাছাই করো</div>
    <div class="speak-row"><button class="speak-btn" style="width:70px;height:70px;font-size:32px" onclick="speak('${e.w.a}')">🔊</button></div>
    <div class="opts grid2">${e.opts.map((o, i) => `<button class="opt" data-i="${i}" onclick="selOpt(this,'${esc(o.a)}')"><span style="font-size:44px">${o.img}</span></button>`).join("")}</div>
    <p style="text-align:center;color:var(--gray);font-weight:600;font-size:13px;margin-top:14px">শুনতে না পেলে 🔊 বোতামটি আবার চাপো</p>`;
    setTimeout(() => speak(e.w.a), 350);
  } else if (e.t === "pic_match") {
    const ar = shuffle(e.pairs.map((p) => p.a)), ic = shuffle(e.pairs.map((p) => p.img));
    A.innerHTML = `<div class="ex-title">শব্দ ও ছবি মেলাও</div><div class="match-cols">
      <div style="display:flex;flex-direction:column;gap:12px">${ar.map((a) => `<button class="opt" data-side="a" data-v="${esc(a)}" onclick="tapMatch(this)"><span class="ar">${tk(a,lvl)}</span></button>`).join("")}</div>
      <div style="display:flex;flex-direction:column;gap:12px">${ic.map((im) => `<button class="opt" data-side="b" data-v="${esc(im)}" style="font-size:26px" onclick="tapMatch(this)">${im}</button>`).join("")}</div></div>`;
    cb.textContent = "সব জোড়া মেলাও";
  } else if (e.t === "match") {
    const ar = shuffle(e.pairs.map((p) => p.a)), bn = shuffle(e.pairs.map((p) => p.b));
    A.innerHTML = `<div class="ex-title">জোড়া মেলাও</div><div class="match-cols">
      <div style="display:flex;flex-direction:column;gap:12px">${ar.map((a) => `<button class="opt" data-side="a" data-v="${esc(a)}" onclick="tapMatch(this)"><span class="ar">${tk(a,lvl)}</span></button>`).join("")}</div>
      <div style="display:flex;flex-direction:column;gap:12px">${bn.map((b) => `<button class="opt" data-side="b" data-v="${esc(b)}" onclick="tapMatch(this)">${b}</button>`).join("")}</div></div>`;
    cb.textContent = "সব জোড়া মেলাও";
  } else if (e.t === "build") {
    const words = shuffle([...e.s.a.split(" "), ...(e.distractors || [])]);
    A.innerHTML = `<div class="ex-title">আরবিতে বাক্যটি সাজাও</div>
    <div class="big-bn" style="font-size:21px">"${e.s.b}"</div>
    <div id="build-answer"></div>
    <div id="build-bank">${words.map((w, i) => `<button class="tile" data-i="${i}" data-w="${esc(w)}" onclick="tapTile(this)"><span class="ar">${tk(w,lvl)}</span></button>`).join("")}</div>`;
  } else if (e.t === "build_ba") {
    const words = shuffle([...e.s.b.split(" "), ...(e.distractors || [])]);
    A.innerHTML = `<div class="ex-title">অর্থ অনুযায়ী বাক্যটি সাজাও</div>
    <div class="speak-row"><button class="speak-btn" onclick="speak('${e.s.a}')">🔊</button></div>
    <div class="big-ar" style="font-size:26px;line-height:2">${tk(e.s.a,lvl)}</div>
    <div id="build-answer" style="direction:ltr"></div>
    <div id="build-bank" style="direction:ltr">${words.map((w, i) => `<button class="tile" data-i="${i}" data-w="${esc(w)}" onclick="tapTile(this)">${esc(w)}</button>`).join("")}</div>`;
    setTimeout(() => speak(e.s.a), 300);
  }
}
/* ── কম্বো (টানা সঠিক উত্তর) ── */
function bumpCombo(good) {
  if (good) {
    L.combo = (L.combo || 0) + 1;
    if (L.combo > (L.maxCombo || 0)) L.maxCombo = L.combo;
    if (L.combo === 3 || L.combo === 5 || L.combo === 8) comboFloat("🔥 কম্বো x" + L.combo + "!");
  } else {
    L.combo = 0;
  }
}
/* ── ইন্টার‌্যাকশন ── */
export function selOpt(el, val) {
  document.querySelectorAll(".opt").forEach((o) => o.classList.remove("sel"));
  el.classList.add("sel"); L.sel = val; $("#btn-check").disabled = false;
}
export function tapMatch(el) {
  const e = L.ex[L.i];
  if (el.classList.contains("faded")) return;
  if (L.matchSel && L.matchSel.dataset.side === el.dataset.side) { L.matchSel.classList.remove("sel"); L.matchSel = el; el.classList.add("sel"); return; }
  if (!L.matchSel) { L.matchSel = el; el.classList.add("sel"); if (el.dataset.side === "a") speak(el.dataset.v); return; }
  const a = L.matchSel.dataset.side === "a" ? L.matchSel : el, b = L.matchSel.dataset.side === "a" ? el : L.matchSel;
  // আরবি টাইল প্রথমে চাপা হলে তখনই উচ্চারণ শোনানো হয়েছে — তখন আর দ্বিতীয়বার নয়
  const alreadySpoke = L.matchSel.dataset.side === "a";
  const good = e.pairs.some((p) => p.a === a.dataset.v && (p.b === b.dataset.v || p.img === b.dataset.v));
  if (good) {
    bumpCombo(true);
    sndPair(); [a, b].forEach((x) => { x.classList.remove("sel"); x.classList.add("ok"); setTimeout(() => x.classList.add("faded"), 350); });
    L.matchDone++; if (!alreadySpoke) speak(a.dataset.v);
    L.correctWords.add(a.dataset.v); if (L.matchDone === e.pairs.length) { $("#btn-check").disabled = false; $("#btn-check").textContent = "চালিয়ে যাও"; feedback(true, "চমৎকার জোড়া!"); L.autoOk = true; }
  } else {
    bumpCombo(false);
    sndBad(); [a, b].forEach((x) => { x.classList.add("bad"); setTimeout(() => x.classList.remove("bad", "sel"), 600); });
    loseHeart(); // মিলে গেলে পুনরায় চেষ্টা করতে দাও; মাঝপথে আটকানো নেই
  }
  L.matchSel = null;
}
export function tapTile(el) {
  if (el.classList.contains("used")) return;
  el.classList.add("used"); L.built.push(el.dataset.w);
  const isAr = !!el.querySelector(".ar");
  const chip = document.createElement("button"); chip.className = "tile";
  chip.innerHTML = isAr ? `<span class="ar">${tk(el.dataset.w, (L && L.tkLvl) || 0)}</span>` : esc(el.dataset.w);
  chip.onclick = () => { L.built.splice(L.built.indexOf(el.dataset.w), 1); chip.remove(); el.classList.remove("used"); $("#btn-check").disabled = L.built.length === 0; };
  $("#build-answer").appendChild(chip);
  $("#btn-check").disabled = false;
}
/* ── ইন্টারঅ্যাকটিভ সফলতা (বলো / লেখো) — মিলে গেলে "চালিয়ে যাও" খোলে ── */
function interactiveSuccess(word, msg) {
  if (L.answered) return;
  L.answered = true;
  bumpCombo(true);
  if (word) L.correctWords.add(word);
  hideSkip();
  feedback(true, msg || praise());
  const cb = $("#btn-check");
  cb.disabled = false; cb.textContent = "চালিয়ে যাও"; cb.onclick = () => next(true);
}
/* ── বলো (কণ্ঠ যাচাই) ── */
export function startSay() {
  const e = L.ex[L.i], btn = $("#say-btn"), fb = $("#say-fb");
  if (!btn || L.answered) return;
  btn.disabled = true; btn.textContent = "🎙️ শুনছি…";
  fb.className = "say-fb"; fb.textContent = "";
  const reset = (txt) => { const b = $("#say-btn"); if (b) { b.disabled = false; b.textContent = txt || "🎤 আবার বলো"; } };
  listenArabic({
    onResult: (alts) => {
      if (sayMatches(alts, e.w.a)) {
        if (fb) { fb.className = "say-fb ok"; fb.textContent = "✅ চমৎকার উচ্চারণ!"; }
        interactiveSuccess(e.w.a, "🎤 শুদ্ধ উচ্চারণ! " + praise());
      } else {
        sndBad();
        if (fb) fb.innerHTML = "❌ ঠিক হয়নি, আবার বলো।" + (alts && alts[0] ? ` <span style="color:var(--gray)">(শুনেছি: ${esc(alts[0])})</span>` : "");
        reset();
      }
    },
    onError: (err) => {
      if (fb) fb.textContent = err === "not-allowed" ? "🎤 মাইক্রোফোনের অনুমতি দাও, অথবা নিচে এড়িয়ে যাও।"
        : err === "no-speech" ? "কিছু শুনতে পাইনি — আবার বলো।" : "আবার চেষ্টা করো।";
      reset();
    },
    onEnd: () => reset(),
  });
}
/* ── লেখো (ট্রেসিং) ── */
let traceState = null;
const traceFont = (px) => `700 ${px}px 'Scheherazade New','Noto Naskh Arabic',serif`;
export function initTrace(word, lvl) {
  const cv = $("#trace-cv"), wrap = $("#trace-wrap");
  if (!cv || !wrap) return;
  const W = Math.max(240, wrap.clientWidth), H = 190, dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
  const shown = tk(word, lvl);
  const mask = document.createElement("canvas"); mask.width = W; mask.height = H;
  const mctx = mask.getContext("2d");
  let size = 110; mctx.font = traceFont(size); mctx.textAlign = "center"; mctx.textBaseline = "middle"; mctx.direction = "rtl";
  while (mctx.measureText(shown).width > W - 24 && size > 34) { size -= 4; mctx.font = traceFont(size); }
  mctx.fillStyle = "#000"; mctx.fillText(shown, W / 2, H / 2);
  const user = document.createElement("canvas"); user.width = W; user.height = H;
  const uctx = user.getContext("2d");
  uctx.lineWidth = 24; uctx.lineCap = "round"; uctx.lineJoin = "round"; uctx.strokeStyle = "#000";
  traceState = { cv, ctx, mask, user, uctx, W, H, drawing: false, last: null, done: false, word };
  redrawTrace();
  const pos = (ev) => { const r = cv.getBoundingClientRect(); const p = ev.touches ? ev.touches[0] : ev; return { x: p.clientX - r.left, y: p.clientY - r.top }; };
  cv.onpointerdown = (ev) => { ev.preventDefault(); traceState.drawing = true; traceState.last = pos(ev); };
  cv.onpointermove = (ev) => {
    if (!traceState.drawing) return; ev.preventDefault();
    const p = pos(ev), u = traceState.uctx;
    u.beginPath(); u.moveTo(traceState.last.x, traceState.last.y); u.lineTo(p.x, p.y); u.stroke();
    traceState.last = p; redrawTrace();
  };
  const end = () => { if (traceState.drawing) { traceState.drawing = false; checkTrace(); } };
  cv.onpointerup = end; cv.onpointerleave = end; cv.onpointercancel = end;
}
function redrawTrace() {
  const s = traceState; if (!s) return;
  s.ctx.clearRect(0, 0, s.W, s.H);
  s.ctx.globalAlpha = 0.16; s.ctx.drawImage(s.mask, 0, 0); s.ctx.globalAlpha = 1;   // ম্লান টেমপ্লেট
  const tmp = document.createElement("canvas"); tmp.width = s.W; tmp.height = s.H;
  const t = tmp.getContext("2d"); t.drawImage(s.user, 0, 0);
  t.globalCompositeOperation = "source-in"; t.fillStyle = "#1cb0f6"; t.fillRect(0, 0, s.W, s.H); // ব্যবহারকারীর কালি নীল
  s.ctx.drawImage(tmp, 0, 0);
}
function checkTrace() {
  const s = traceState; if (!s || s.done) return;
  const mi = s.mask.getContext("2d").getImageData(0, 0, s.W, s.H).data;
  const ui = s.uctx.getImageData(0, 0, s.W, s.H).data;
  const C = 6; let ink = 0, hit = 0;
  for (let y = 0; y < s.H; y += C) for (let x = 0; x < s.W; x += C) {
    let m = false, u = false;
    for (let dy = 0; dy < C; dy++) for (let dx = 0; dx < C; dx++) {
      const idx = ((y + dy) * s.W + (x + dx)) * 4 + 3;
      if (mi[idx] > 40) m = true;
      if (ui[idx] > 40) u = true;
    }
    if (m) { ink++; if (u) hit++; }
  }
  const cov = ink ? hit / ink : 0, fb = $("#trace-fb");
  if (cov >= 0.55) {
    s.done = true;
    if (fb) { fb.className = "say-fb ok"; fb.textContent = "✅ সুন্দর লেখা!"; }
    interactiveSuccess(s.word, "✍️ লেখা সম্পূর্ণ! " + praise());
  } else if (fb) {
    fb.className = "say-fb"; fb.textContent = `আরেকটু অক্ষরের উপর লেখো — ${Math.round(cov * 100)}% হয়েছে`;
  }
}
export function traceClear() {
  const s = traceState; if (!s) return;
  s.uctx.clearRect(0, 0, s.W, s.H); s.done = false; redrawTrace();
  const fb = $("#trace-fb"); if (fb) { fb.className = "say-fb"; fb.textContent = ""; }
}
/* ── যাচাই ── */
/* প্রশ্নের সঠিক উত্তরটি — যাচাই ও "এড়িয়ে যাও" দুই জায়গাতেই লাগে */
function correctTextFor(e) {
  if (e.t === "mc_ab") return e.w.b;
  if (e.t === "mc_ba" || e.t === "listen" || e.t === "pic_mc" || e.t === "pic_ba" || e.t === "listen_pic" || e.t === "say" || e.t === "trace") return e.w.a;
  if (e.t === "build") return e.s.a;
  if (e.t === "build_ba") return e.s.b;
  if (e.t === "tr") return e.s.b;
  if (e.t === "qa" || e.t === "fill") return e.ans;
  if (e.t === "match" || e.t === "pic_match") return e.pairs.map((p) => p.a).join(" · ");
  return "";
}
function hideSkip() { const b = $("#btn-skip"); if (b) b.classList.add("hide"); }
/* ডুয়োলিঙ্গোর মতো: উত্তর না জানলে এড়িয়ে যাও — সঠিক উত্তরটি দেখিয়ে পরেরটিতে যায়
   (ভুলের মতোই গণ্য হয়, তাই একটি হৃদয় কমে) */
export function skipEx() {
  if (!L || L.answered) return;
  const e = L.ex[L.i];
  L.answered = true;
  L.wrong++; bumpCombo(false); loseHeart();
  const correctTxt = correctTextFor(e);
  feedback(false, "সঠিক উত্তর: " + correctTxt);
  if (/[؀-ۿ]/.test(correctTxt)) speak(correctTxt);
  hideSkip();
  const cb = $("#btn-check");
  cb.disabled = false; cb.textContent = "বুঝেছি"; cb.onclick = () => next(false);
}
export function checkAnswer() {
  const e = L.ex[L.i];
  if (L.autoOk) { L.autoOk = false; next(true); return; }
  L.answered = true; hideSkip();
  const correctTxt = correctTextFor(e);
  let good = false;
  if (e.t === "mc_ab") good = L.sel === e.w.b;
  else if (e.t === "mc_ba" || e.t === "listen") good = L.sel === e.w.a;
  else if (e.t === "build") good = L.built.join(" ") === e.s.a;
  else if (e.t === "build_ba") good = L.built.join(" ") === e.s.b;
  else if (e.t === "tr") good = L.sel === e.s.b;
  else if (e.t === "qa" || e.t === "fill") good = L.sel === e.ans;
  else if (e.t === "pic_mc" || e.t === "pic_ba" || e.t === "listen_pic") good = L.sel === e.w.a;
  document.querySelectorAll(".opt").forEach((o) => {
    const v = o.dataset.v || o.textContent.trim();
    if (o.classList.contains("sel")) o.classList.add(good ? "ok" : "bad");
  });
  if (good) {
    bumpCombo(true);
    if (e.w) L.correctWords.add(e.w.a);
    // ডুয়োলিঙ্গো-স্টাইল: সঠিক হলে শুধু সফলতার চিমে — শব্দটি আবার পড়ে শোনানো হয় না,
    // কারণ প্রশ্নের সময় সেটি একবার শোনানো হয়েই গেছে (আগে দুইবার শোনা যেত)।
    feedback(true, praise());
    $("#btn-check").textContent = "চালিয়ে যাও"; $("#btn-check").onclick = () => next(true);
  } else {
    bumpCombo(false);
    L.wrong++; loseHeart();
    // শুরু করা পাঠটি সবসময় শেষ করতে দাও — মাঝপথে হৃদয় শেষ হলেও আটকাবে না (নতুন
    // শিক্ষার্থীর জন্য কোমল)। নতুন পাঠ শুরুর সময় হৃদয়ের শর্ত ঠিকই থাকে।
    feedback(false, "সঠিক উত্তর: " + correctTxt);
    // ভুল হলে সঠিক আরবিটি একবার শুনিয়ে দাও — এতে শুদ্ধ উচ্চারণ শেখা হয়
    if (/[؀-ۿ]/.test(correctTxt)) speak(correctTxt);
    $("#btn-check").textContent = "বুঝেছি"; $("#btn-check").onclick = () => next(false);
  }
}
export function praise() { return shuffle(["মাশাআল্লাহ! 🎉", "মারহাবা!🎉", "সুবহানাল্লাহ!", "আল্লাহু আকবার!", "চমৎকার!", "দারুণ! ⭐", "একদম ঠিক!", "বাহ্‌!"])[0]; }
export function feedback(ok, txt) {
  if (ok) sndOk(); else sndBad();
  $("#check-bar").className = ok ? "ok" : "bad";
  $("#fb-text").textContent = (ok ? "✅ " : "❌ ") + txt;
  const cb = $("#btn-check"); cb.disabled = false; cb.classList.toggle("red", !ok);
}
export function loseHeart() { S.hearts = Math.max(0, S.hearts - 1); save(); setProgress(); updateTop(); }
export function next(wasOk) {
  const cb = $("#btn-check"); cb.classList.remove("red");
  L.i++;
  if (L.i >= L.ex.length) finishLesson(); else renderEx();
}
/* ── সমাপ্তি ── */
export function finishLesson() {
  stopSpeech();
  const perfect = L.wrong === 0;
  const accuracy = (L.ex.length - L.wrong) / L.ex.length;
  const passedHalf = accuracy >= 0.5;
  const comboBonus = (L.maxCombo || 0) >= 8 ? 20 : (L.maxCombo || 0) >= 5 ? 10 : (L.maxCombo || 0) >= 3 ? 5 : 0;
  let xp = (L.review ? L.ex.length * 5 + (perfect ? 10 : 0) : L.ex.length * 10 + (perfect ? 20 : 0)) + comboBonus;
  let gems = L.review ? 2 + Math.floor(Math.random() * 4) : 5 + Math.floor(Math.random() * 6);
  const hadGoal = S.dayXP >= S.goal;
  const prevLvl = Math.min(LEVELS.length - 1, Math.floor(S.xp / 150));
  S.xp += xp; S.gems += gems; S.dayXP += xp; S.lessonsDone++; if (perfect) S.perfect++;
  const newLvl = Math.min(LEVELS.length - 1, Math.floor(S.xp / 150));
  L.leveledUp = newLvl > prevLvl ? newLvl : null;
  L.wasFirstCompletion = !L.review && (S.crowns[L.ui] || 0) === 0;
  if (!L.review) {
    S.crowns[L.ui] = Math.min(3, (S.crowns[L.ui] || 0) + 1);
    L.correctWords.forEach((w) => { const v = UNITS[L.ui].vocab.find((x) => x.a === w); if (v) { S.words[w] = v.b; seedWord(w, true); } });
    UNITS[L.ui].vocab.forEach((v) => { if (Math.random() < .4) { S.words[v.a] = v.b; seedWord(v.a, false); } });
  } else {
    // ঝালাই শেষে প্রতিটি পরীক্ষিত শব্দের সূচি হালনাগাদ — সঠিক হলে পিছিয়ে, ভুলে সামনে
    const tested = new Set();
    L.ex.forEach((e) => { if (e.w) tested.add(e.w.a); if (e.pairs) e.pairs.forEach((p) => tested.add(p.a)); });
    tested.forEach((a) => scheduleWord(a, L.correctWords.has(a)));
  }
  if (!hadGoal && S.dayXP >= S.goal) xpFloat("🎯 দৈনিক লক্ষ্য!");
  bumpStreak(); S.chestCount++;
  const newBadges = BADGES.filter((b) => !S.badges[b.id] && b.chk(S));
  newBadges.forEach((b) => S.badges[b.id] = true);
  save(); updateTop();
  $("#scr-lesson").classList.remove("active");
  const R = $("#scr-result"); R.classList.add("active");
  R.innerHTML = `<div class="result-wrap">
    <div class="emo">${perfect ? "🌟" : "🎉"}</div>
    <h1>${perfect ? "নিখুঁত পাঠ! মাশাআল্লাহ!" : "পাঠ সম্পূর্ণ!"}</h1>
    <p style="color:var(--gray);font-weight:600">${L.review ? "🔁 শব্দ অনুশীলন" : UNITS[L.ui].title + " · মুকুট " + S.crowns[L.ui] + "/৩"}</p>
    <div class="result-cards">
      <div class="rcard" style="border-color:var(--gold)"><div class="top" style="background:var(--gold)">মোট XP</div><div class="val" style="color:var(--gold)">⚡${xp}</div></div>
      <div class="rcard" style="border-color:var(--blue)"><div class="top" style="background:var(--blue)">রত্ন</div><div class="val" style="color:var(--blue)">💎${gems}</div></div>
      <div class="rcard" style="border-color:var(--green)"><div class="top" style="background:var(--green)">সঠিকতা</div><div class="val" style="color:var(--green-d)">${Math.round(accuracy * 100)}%</div></div>
    </div>
    <div id="result-extra">${comboBonus ? `<p style="color:var(--orange);font-weight:800;margin-top:10px">🔥 সর্বোচ্চ কম্বো x${L.maxCombo} — বোনাস ⚡${comboBonus} XP!</p>` : ""}
    ${passedHalf ? `<div class="dua-box">
      <p class="t">🤲 জ্ঞান বৃদ্ধির দোয়া</p>
      <p class="ar">رَبِّ زِدْنِي عِلْمًا</p>
      <p class="bn">"হে আমার রব! আমার জ্ঞান বৃদ্ধি করে দিন" — সবার জন্য এই দোয়া (সূরা ত্বহা, ২০:১১৪)</p>
    </div>` : ""}</div>
    <button class="btn" onclick="afterResult()">চালিয়ে যাও</button>
  </div>`;
  L.newBadges = newBadges;
  if (perfect) celebrateConfetti();
  if (passedHalf) setTimeout(() => speak("مَا شَاءَ اللّٰهُ! مَرْحَبًا!"), 500);
  window.scrollTo(0, 0);
}
export function afterResult() {
  if (L.newBadges && L.newBadges.length) {
    const b = L.newBadges.shift();
    modal(`<div class="emo">${b.emo}</div><h2>নতুন অর্জন: ${b.nm}</h2><p>${b.desc}</p>`, `<button class="btn" onclick="closeModal();afterResult()">দারুণ!</button>`);
    return;
  }
  if (L.leveledUp != null) {
    const lvl = L.leveledUp; L.leveledUp = null;
    modal(`<div class="emo">${LEVELS[lvl].e}</div><h2>লেভেল আপ! 🎉</h2><p>তুমি এখন <b>লেভেল ${lvl + 1}</b>: ${LEVELS[lvl].t}!</p>`, `<button class="btn" onclick="closeModal();afterResult()">দারুণ!</button>`);
    return;
  }
  if (S.chestCount % 3 === 0 && S.chestCount > 0) {
    S.chestCount++; // যেন বারবার না আসে
    const r = Math.random(), prize = r < .5 ? { e: "💎", t: "রত্ন", v: 10 + Math.floor(Math.random() * 15) } : r < .8 ? { e: "⚡", t: "বোনাস XP", v: 20 + Math.floor(Math.random() * 30) } : { e: "❤️", t: "হৃদয় রিফিল", v: 0 };
    if (prize.t === "রত্ন") S.gems += prize.v; else if (prize.t === "বোনাস XP") S.xp += prize.v; else S.hearts = 5;
    save(); updateTop();
    modal(`<div class="emo">🎁</div><h2>রহস্য সিন্দুক!</h2><p>তুমি পেলে: ${prize.e} ${prize.v || "সম্পূর্ণ"} ${prize.t}!</p>`, `<button class="btn" onclick="closeModal();afterResult()">আলহামদুলিল্লাহ!</button>`);
    return;
  }
  if (L && L.wasFirstCompletion && !(S.visualDone && S.visualDone[L.ui])) {
    if (maybeVisualChallenge(L.ui)) return;
  }
  showTab("home");
}
