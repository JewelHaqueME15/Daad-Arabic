import { $ } from "./utils.js";
import { S, save } from "./state.js";
import { ttsUrl } from "./api.js";
import { modal, closeModal } from "./ui.js";

/* ════════ SOUND EFFECTS (WebAudio) ════════ */
let AC = null;
function ac() { try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); return AC; } catch (e) { return null; } }
function tone(f, t0, dur, type, vol) { const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain(); o.type = type || "sine"; o.frequency.value = f; o.connect(g); g.connect(c.destination); const t = c.currentTime + t0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .22, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.start(t); o.stop(t + dur + .05); }
export function sndOk() { tone(587, 0, .14); tone(784, .11, .16); tone(1047, .22, .24); }
export function sndBad() { tone(233, 0, .22, "sawtooth", .14); tone(175, .16, .32, "sawtooth", .14); }
export function sndPair() { tone(880, 0, .1, "sine", .15); }
document.addEventListener("pointerdown", function once() {
  ac();
  if ("speechSynthesis" in window) { try { speechSynthesis.resume(); } catch (e) {} }
  voicesReady(); // প্রথম ট্যাপেই ভয়েস তালিকা গরম করে রাখো
  document.removeEventListener("pointerdown", once);
}, { once: true });

/* ════════ ভয়েস তালিকা ════════ */
/* Chrome-এ getVoices() প্রথমে খালি অ্যারে দেয়, ভয়েস আসে অ্যাসিঙ্ক্রোনাসভাবে।
   আগে এ কারণেই লিঙ্গ-বাছাই কাজ করত না: প্রথম উচ্চারণের সময় তালিকা খালি থাকায়
   ছেলে/মেয়ে কণ্ঠ খুঁজে পাওয়া যেত না। তাই তালিকা প্রস্তুত হওয়া পর্যন্ত অপেক্ষা করি। */
let voicesPromise = null;
export function voicesReady() {
  if (!("speechSynthesis" in window)) return Promise.resolve([]);
  const have = speechSynthesis.getVoices();
  if (have && have.length) return Promise.resolve(have);
  if (voicesPromise) return voicesPromise;
  voicesPromise = new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(speechSynthesis.getVoices() || []); };
    try { speechSynthesis.addEventListener("voiceschanged", finish, { once: true }); } catch (e) { speechSynthesis.onvoiceschanged = finish; }
    setTimeout(finish, 2000); // কোনো ব্রাউজার ইভেন্ট না দিলেও আটকে থেকো না
  });
  return voicesPromise;
}
function arVoices() {
  if (!("speechSynthesis" in window)) return [];
  const vs = speechSynthesis.getVoices() || [];
  return vs.filter((v) => (v.lang && v.lang.toLowerCase().startsWith("ar")) || /arab|عرب/i.test(v.name || ""));
}
/* ভয়েসের নাম দেখে লিঙ্গ অনুমান — উইন্ডোজ/অ্যাপল/অ্যান্ড্রয়েডের প্রচলিত আরবি কণ্ঠগুলো।
   (ব্রাউজার API সরাসরি লিঙ্গ জানায় না, তাই নামই ভরসা।)
   সতর্কতা: "female"-এর ভেতরেও "male" আছে, তাই \bmale\b শব্দ-সীমা ব্যবহার করা হয়েছে। */
const MALE_VOICE_RE = /naayf|nayf|majed|maged|tarik|tariq|hamed|hamza|mehdi|shakir|hamdan|abdullah|fahed|saleh|moaz|ahmed|omar|khalid|\bmale\b/i;
const FEMALE_VOICE_RE = /hoda|huda|laila|layla|salma|zahra|amira|sana|fatima|zariyah|amany|noura|nora|hala|rana|iman|mariam|\bfemale\b/i;
function voiceGender(v) {
  const n = (v && v.name) || "";
  if (FEMALE_VOICE_RE.test(n)) return "female"; // আগে দেখো — "female"-এ "male" আছে
  if (MALE_VOICE_RE.test(n)) return "male";
  return null;
}
export function genderVoice(gender) {
  if (!gender) return null;
  return arVoices().find((v) => voiceGender(v) === gender) || null;
}
/* সবচেয়ে ভালো আরবি কণ্ঠ বাছাই: লিঙ্গ-মিল > ফুসহা (ar-SA) > যেকোনো আরবি */
function pickVoice() {
  const g = (S && S.gender) ? genderVoice(S.gender) : null;
  if (g) return g;
  const vs = arVoices();
  return vs.find((v) => /^ar[-_]sa/i.test(v.lang || "")) || vs[0] || null;
}
/* বাছাই করা কণ্ঠ শিক্ষার্থীর লিঙ্গের সাথে না মিললে পিচ সামান্য বদলে কাছাকাছি করা হয় —
   এতে ডিভাইসে আলাদা ছেলে/মেয়ে কণ্ঠ না থাকলেও লিঙ্গ-বাছাইয়ের প্রভাব শোনা যায়। */
function genderPitch(v) {
  if (!S || !S.gender) return 1;
  if (voiceGender(v) === S.gender) return 1;
  return S.gender === "male" ? 0.8 : 1.25;
}

/* ════════ লম্বা লেখা টুকরো করা ════════ */
/* Google-এর TTS একবারে ~২০০ অক্ষরের বেশি নেয় না — লম্বা আয়াত পাঠালে অডিও মাঝপথে
   কেটে যেত। তাই শব্দ-সীমানায় টুকরো করে একের পর এক বাজানো হয়। */
const MAX_TTS_CHARS = 170;
export function chunkText(txt) {
  const t = String(txt || "").trim().replace(/\s+/g, " ");
  if (!t) return [];
  if (t.length <= MAX_TTS_CHARS) return [t];
  const out = [], words = t.split(" ");
  let cur = "";
  for (const w of words) {
    if (cur && (cur.length + 1 + w.length) > MAX_TTS_CHARS) { out.push(cur); cur = w; }
    else cur = cur ? cur + " " + w : w;
  }
  if (cur) out.push(cur);
  return out;
}

/* ════════ TTS ════════ */
/* speakSeq: প্রতিটি নতুন speak() আগের সব অসমাপ্ত কাজ বাতিল করে দেয়। আগে এটি না
   থাকায় পুরনো ডাকের টাইমার পরে চালু হয়ে আগের শব্দটি নতুনটির উপর বলে ফেলত। */
let speakSeq = 0, curAudio = null, soundFailCount = 0, soundNoticeShown = false;
const keepUtter = []; // Chrome GC বাগ: রেফারেন্স না রাখলে মাঝপথে থেমে যায়

function stopAudio() {
  if (!curAudio) return;
  try { curAudio.pause(); curAudio.removeAttribute("src"); curAudio.load(); } catch (e) {}
  curAudio = null;
}
export function stopSpeech() {
  speakSeq++; // চলমান সব অ্যাসিঙ্ক ধাপ অকার্যকর করো
  stopAudio();
  if ("speechSynthesis" in window) { try { speechSynthesis.cancel(); } catch (e) {} }
}

export function toggleSound(explicit) {
  S.soundOn = (typeof explicit === "boolean") ? explicit : !S.soundOn;
  save(); updateSoundBtn();
  if (!S.soundOn) stopSpeech();
}
export function updateSoundBtn() { const b = $("#sound-toggle"); if (b) b.textContent = S.soundOn ? "🔊" : "🔇"; }
function noteSoundFailure() {
  soundFailCount++;
  if (soundFailCount >= 2 && !soundNoticeShown) {
    soundNoticeShown = true;
    modal(`<div class="emo">🔇</div><h2>উচ্চারণ শোনা যাচ্ছে না?</h2><p>তোমার ডিভাইসে আরবি উচ্চারণ ঠিকমতো চলছে না মনে হচ্ছে। চিন্তা নেই — উচ্চারণ ছাড়াই পাঠ চালিয়ে যেতে পারবে, এটা কোনো বাধা নয়।<br><br>বারবার চেষ্টা করে সময় নষ্ট এড়াতে উপরের 🔊 বোতাম চেপে শব্দ বন্ধ করে দিতে পারো।<br><br>অফলাইনে শুনতে চাইলে Windows/Android-এ আরবি ভয়েস ইনস্টল করে ব্রাউজার রিস্টার্ট করো।</p>`,
      `<button class="btn blue" onclick="closeModal()">ঠিক আছে, চালিয়ে যাই</button><div style="height:10px"></div><button class="btn ghost" onclick="closeModal();toggleSound(false)">🔇 শব্দ বন্ধ করে দাও</button>`);
  }
}

/* ধাপ ১: সার্ভার-প্রক্সি করা TTS (/api/tts) — একটাই স্পষ্ট আরবি কণ্ঠ, মান ভালো।
   লিঙ্গ-মিল কণ্ঠ ডিভাইসে থাকলে সেটিকেই অগ্রাধিকার (তাতে ছেলে/মেয়ে বাছাই কাজ করে)। */
export function speak(txt) {
  if (!txt) return;
  const seq = ++speakSeq;
  stopAudio();
  if ("speechSynthesis" in window) { try { speechSynthesis.cancel(); } catch (e) {} }
  if (!S.soundOn) return;
  const parts = chunkText(txt);
  if (!parts.length) return;

  const route = () => {
    if (seq !== speakSeq) return;
    // লিঙ্গ বাছাই থাকলে এবং সেই কণ্ঠ ডিভাইসে থাকলে — ডিভাইসের কণ্ঠেই বলো
    if (S.gender && genderVoice(S.gender)) { deviceSpeak(parts, seq); return; }
    if (navigator.onLine === false) { deviceSpeak(parts, seq); return; }
    netSpeak(parts, seq);
  };
  // ভয়েস তালিকা তৈরি থাকলে সঙ্গে সঙ্গে, নইলে তৈরি হওয়ার পর সিদ্ধান্ত নাও
  const have = ("speechSynthesis" in window) ? (speechSynthesis.getVoices() || []) : [];
  if (have.length || !S.gender) route();
  else voicesReady().then(route);
}

/* নেটওয়ার্ক অডিও — টুকরোগুলো একের পর এক। ব্যর্থ হলে বাকিটা ডিভাইসের কণ্ঠে। */
function netSpeak(parts, seq) {
  let i = 0;
  const playNext = () => {
    if (seq !== speakSeq || i >= parts.length) return;
    const part = parts[i++];
    const a = new Audio();
    a.preload = "auto";
    a.src = ttsUrl(part);
    curAudio = a;
    let started = false, dead = false;
    const abort = () => { try { a.pause(); a.removeAttribute("src"); a.load(); } catch (e) {} };
    const fail = () => {
      if (started || dead) return;
      dead = true; clearTimeout(timer);
      abort(); // গুরুত্বপূর্ণ: না থামালে পরে এটি বাজতে শুরু করে দুই কণ্ঠ একসাথে শোনা যেত
      if (seq !== speakSeq) return;
      curAudio = null;
      deviceSpeak(parts.slice(i - 1), seq); // যেখান থেকে আটকেছে, সেখান থেকেই
    };
    a.addEventListener("playing", () => { started = true; clearTimeout(timer); soundFailCount = 0; }, { once: true });
    a.addEventListener("ended", () => { if (seq === speakSeq) playNext(); }, { once: true });
    a.addEventListener("error", fail);
    const timer = setTimeout(fail, 5000); // ধীর নেটে সময় দাও, তবে ঝুলে থাকলে ফলব্যাক
    const pr = a.play();
    if (pr && pr.catch) pr.catch(fail);
  };
  playNext();
}

/* ধাপ ২: ডিভাইসের নিজস্ব ভয়েস (ফলব্যাক ও লিঙ্গ-মিল কণ্ঠ) */
function deviceSpeak(parts, seq) {
  if (!S.soundOn) return;
  if (!("speechSynthesis" in window)) { noteSoundFailure(); return; }
  voicesReady().then((vs) => {
    if (seq !== speakSeq) return;
    if (!vs.length) { noteSoundFailure(); return; }
    const v = pickVoice();
    if (!v) { noteSoundFailure(); return; }
    soundFailCount = 0;
    try { speechSynthesis.cancel(); } catch (e) {}
    let i = 0;
    const sayNext = () => {
      if (seq !== speakSeq || i >= parts.length) return;
      const u = new SpeechSynthesisUtterance(parts[i++]);
      keepUtter.push(u); if (keepUtter.length > 8) keepUtter.shift();
      u.voice = v;
      u.lang = v.lang || "ar-SA";
      u.rate = .82; u.volume = 1; u.pitch = genderPitch(v);
      u.onend = () => { if (seq === speakSeq) sayNext(); };
      u.onerror = () => { if (seq === speakSeq) sayNext(); };
      try { speechSynthesis.resume(); } catch (e) {}
      speechSynthesis.speak(u);
    };
    /* Chrome বাগ: cancel-এর পরপরই speak দিলে নীরব থাকে — সামান্য বিরতি দরকার */
    setTimeout(sayNext, 90);
  });
}
/* পুরনো নাম — অন্য মডিউল থেকে ডাকা হলে যেন ভাঙে না */
export function ttsSpeak(txt) { deviceSpeak(chunkText(txt), ++speakSeq); }
