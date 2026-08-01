/* ════════ ফ্ল্যাশকার্ড — শেখা শব্দ মজায় মজায় ঝালাই ════════
   শব্দভাণ্ডার ট্যাব থেকে চালু হয়। সামনে আরবি শব্দ, চাপলে কার্ড উল্টে অর্থ দেখায়।
   "জানি" চাপলে শব্দটি ⭐ পায় (সর্বোচ্চ ৩), "আবার" চাপলে কার্ডটি ডেকের শেষে ফিরে
   যায় — সব কার্ড শেষ হলে সেশন শেষ। তারাগুলো শব্দ-তালিকাতেও দেখা যায়। */
import { $, shuffle } from "./utils.js";
import { S, save } from "./state.js";
import { BADGES } from "./data.js";
import { wordIcon, starsHTML } from "./icons.js";
import { modal, closeModal, showTab, updateTop, comboFloat, celebrateConfetti } from "./ui.js";
import { speak, sndOk, sndPair, stopSpeech } from "./tts.js";

export let F = null;

function wordStars(a) { return (S.wordStars && S.wordStars[a]) || 0; }

export function startFlash() {
  const ws = Object.entries(S.words).map(([a, b]) => ({ a, b }));
  if (ws.length < 4) {
    modal(`<div class="emo">🌱</div><h2>আরেকটু শেখো!</h2><p>অন্তত ৪টি শব্দ শিখলে ফ্ল্যাশকার্ড খুলবে। আগে কয়েকটি পাঠ শেষ করো।</p>`,
      `<button class="btn blue" onclick="closeModal()">ঠিক আছে</button>`);
    return;
  }
  F = { queue: shuffle(ws), total: ws.length, done: 0, firstTry: 0, again: 0, combo: 0, maxCombo: 0, tried: {}, flipped: false };
  ["home", "words", "league", "profile"].forEach((x) => $("#scr-" + x).classList.remove("active"));
  $("#topbar").style.display = "none"; $("#tabbar").style.display = "none";
  $("#scr-flash").classList.add("active");
  renderCard();
  window.scrollTo(0, 0);
}

function setFlashProgress() {
  const pct = F.total ? Math.round((F.done / F.total) * 100) : 0;
  $("#flash-pbar>div").style.width = pct + "%";
  $("#flash-count").textContent = F.done + "/" + F.total;
}

function renderCard() {
  const c = F.queue[0];
  F.flipped = false;
  setFlashProgress();
  const ico = wordIcon(c.a);
  const safe = c.a.replace(/'/g, "\\'");
  $("#flash-area").innerHTML = `
    <div class="flash-stage">
      <div class="flash-card" id="flash-card" onclick="flipCard()">
        <div class="fc-face fc-front">
          <div class="fc-tag">আরবি</div>
          ${ico ? `<div class="fc-icon">${ico}</div>` : ""}
          <div class="ar fc-word">${c.a}</div>
          <button class="fc-sp" onclick="event.stopPropagation();speak('${safe}')">🔊</button>
          <div class="fc-hint">কার্ডে চাপো — অর্থ দেখো 👆</div>
        </div>
        <div class="fc-face fc-back">
          <div class="fc-tag blue">অর্থ</div>
          ${ico ? `<div class="fc-icon">${ico}</div>` : ""}
          <div class="fc-mean">${c.b}</div>
          <div class="fc-stars">${starsHTML(wordStars(c.a))}</div>
        </div>
      </div>
    </div>`;
  $("#flash-bar").innerHTML = `<button class="btn blue" onclick="flipCard()">🔄 উল্টাও — অর্থ দেখো</button>`;
  setTimeout(() => speak(c.a), 250);
}

export function flipCard() {
  if (!F || F.flipped) return;
  F.flipped = true;
  $("#flash-card").classList.add("flipped");
  $("#flash-bar").innerHTML = `<div class="flash-actions">
    <button class="btn ghost" onclick="flashAgain()">🔁 আবার</button>
    <button class="btn" onclick="flashKnown()">✅ জানি</button>
  </div>`;
}

function bumpStar(a, delta) {
  if (!S.wordStars) S.wordStars = {};
  S.wordStars[a] = Math.max(0, Math.min(3, (S.wordStars[a] || 0) + delta));
}

export function flashKnown() {
  if (!F || !F.flipped) return;
  const c = F.queue.shift();
  if (!F.tried[c.a]) F.firstTry++;   // প্রথমবারেই পেরেছে
  bumpStar(c.a, 1);
  F.combo++; if (F.combo > F.maxCombo) F.maxCombo = F.combo;
  if (F.combo === 3 || F.combo === 5 || F.combo === 10) comboFloat("🔥 কম্বো x" + F.combo + "!");
  F.done++; sndOk(); save();
  nextCard();
}

export function flashAgain() {
  if (!F || !F.flipped) return;
  const c = F.queue.shift();
  F.tried[c.a] = true; F.again++;
  bumpStar(c.a, -1);
  F.combo = 0; sndPair(); save();
  F.queue.push(c);                    // ডেকের শেষে ফিরে যাক, আবার আসবে
  nextCard();
}

function nextCard() {
  if (!F.queue.length) { finishFlash(); return; }
  renderCard();
}

export function quitFlash() {
  if (confirm("ফ্ল্যাশকার্ড বন্ধ করবে?")) { stopSpeech(); F = null; showTab("words"); }
}

function finishFlash() {
  stopSpeech();
  const perfect = F.again === 0;
  const xp = F.total * 3 + (perfect ? 15 : 0);
  const gems = 2 + Math.floor(Math.random() * 4);
  const mastered = Object.values(S.wordStars || {}).filter((v) => v >= 3).length;
  S.xp += xp; S.gems += gems; S.dayXP += xp;
  S.flashDone = (S.flashDone || 0) + 1;
  const newBadges = BADGES.filter((b) => !S.badges[b.id] && b.chk(S));
  newBadges.forEach((b) => S.badges[b.id] = true);
  save(); updateTop();
  if (perfect) celebrateConfetti();
  const badgeLine = newBadges.length
    ? `<p style="color:var(--purple);font-weight:800;margin-top:8px">🎖️ নতুন অর্জন: ${newBadges.map((b) => b.emo + " " + b.nm).join(", ")}</p>` : "";
  modal(`<div class="emo">${perfect ? "🌟" : "🃏"}</div>
    <h2>${perfect ? "নিখুঁত! সব একবারেই মনে ছিল!" : "ফ্ল্যাশকার্ড শেষ!"}</h2>
    <div class="flash-result">
      <div><b>${F.total}</b><span>কার্ড</span></div>
      <div><b>${F.firstTry}</b><span>একবারেই</span></div>
      <div><b>⭐${mastered}</b><span>মুখস্থ</span></div>
    </div>
    <p style="margin-top:12px">⚡${xp} XP · 💎${gems} রত্ন${F.maxCombo >= 3 ? ` · 🔥 কম্বো x${F.maxCombo}` : ""}</p>${badgeLine}`,
    `<button class="btn" onclick="closeModal();showTab('words')">আলহামদুলিল্লাহ!</button>`);
  F = null;
}
