import { $ } from "./utils.js";
import { S, save } from "./state.js";
import { STORIES, BADGES } from "./data.js";
import { modal, closeModal, showTab, updateTop, xpFloat, storyLockedMsg } from "./ui.js";

export let curStory = null;
export function openStory(idx) {
  const st = STORIES[idx];
  const unlocked = S.isAdmin || (S.crowns[st.afterId] || 0) > 0;
  if (!unlocked) { storyLockedMsg(); return; }
  curStory = idx;
  ["home", "words", "league", "profile"].forEach((x) => $("#scr-" + x).classList.remove("active"));
  $("#scr-lesson").classList.remove("active"); $("#scr-result").classList.remove("active"); $("#scr-vocab").classList.remove("active"); $("#scr-visual").classList.remove("active");
  $("#topbar").style.display = "none"; $("#tabbar").style.display = "none";
  $("#story-top .ttl").textContent = st.icon + " " + st.title;
  const already = S.storiesDone && S.storiesDone[st.id];
  // অনুচ্ছেদ-রীতি: পুরো গল্পটি ইন্দো-পাক ফন্টে একটানা আরবি, তারপর নিচে পুরো বাংলা অনুবাদ
  const arabicPara = st.lines.map((ln) => ln.a).join("، ").replace(/،\s*$/, "");
  const banglaPara = st.lines.map((ln) => ln.b).join("। ") + "।";
  const speakAll = st.lines.map((ln) => ln.a).join(" ، ").replace(/'/g, "\\'");
  $("#story-body").innerHTML = `<div class="story-head"><div class="emo">${st.icon}</div><h1>${st.title}</h1>
    <p style="color:var(--gray);font-weight:600;font-size:13.5px;margin-top:4px">${st.sub}</p></div>
    <div class="story-para ar-para">
      <div class="sp-label">📖 القِصّة — গল্প
        <button class="sp" onclick="speak('${speakAll}')">🔊</button></div>
      <p class="ar">${arabicPara}</p>
    </div>
    <div class="story-para bn-para">
      <div class="sp-label">📝 অনুবাদ</div>
      <p class="bn">${banglaPara}</p>
    </div>
    <details class="story-lines"><summary>বাক্য ধরে ধরে (আরবি + অর্থ)</summary>
      ${st.lines.map((ln) => `<div class="story-line"><span class="ar">${ln.a}<button class="sp" onclick="speak('${ln.a.replace(/'/g, "\\'")}')">🔊</button></span><span class="bn">${ln.b}</span></div>`).join("")}
    </details>`;
  $("#story-finish-btn").textContent = already ? "আবার পড়লাম — ফিরে যাই" : "শেষ করলাম ✅ (+XP পাবে)";
  $("#scr-story").classList.add("active");
  window.scrollTo(0, 0);
}
export function finishStory() {
  const st = STORIES[curStory];
  if (!S.storiesDone) S.storiesDone = {};
  const already = S.storiesDone[st.id];
  if (!already) {
    S.storiesDone[st.id] = true; S.xp += 25; S.gems += 8; S.dayXP += 25;
    save(); updateTop();
    const newBadges = BADGES.filter((b) => !S.badges[b.id] && b.chk(S));
    newBadges.forEach((b) => S.badges[b.id] = true); save();
    xpFloat("⚡+25 XP");
    if (newBadges.length) {
      showTab("home");
      modal(`<div class="emo">${newBadges[0].emo}</div><h2>নতুন অর্জন: ${newBadges[0].nm}</h2><p>${newBadges[0].desc}</p>`, `<button class="btn" onclick="closeModal()">দারুণ!</button>`);
      return;
    }
  }
  showTab("home");
}
