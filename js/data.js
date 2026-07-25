/* পাঠ, গল্প, অধ্যায় ও আইকনের আসল লেখা এখন content/ ফোল্ডারের JSON ফাইলে —
   সেখান থেকে npm run build:content দিয়ে js/content.generated.js তৈরি হয়। */
import { RAW_UNITS, RAW_STORIES, SECTIONS, BOOK_ORDER } from "./content.generated.js";
export { SECTIONS, BOOK_ORDER };
/* ════════ বইয়ের ক্রম ════════
   BOOK_ORDER = পাঠের মূল (স্থায়ী) আইডি বইয়ের ক্রমে সাজানো — এটি এখন একমাত্র
   উৎস content/book.json থেকে তৈরি হয় (npm run build:content)। অ্যাপে পাঠ ভিন্ন
   সময়ে যোগ হওয়ায় আইডি এলোমেলো; এখানে সূচক = বইয়ের অবস্থান।
   পুরনো ব্যবহারকারীর মুকুট যেন না হারায়, তাই state.js-এ একবার ম্যাপিং চলে। */
/* পুরনো আইডি → নতুন অবস্থান */
export const NEW_OF_OLD = BOOK_ORDER.reduce((m,oldId,i)=>{m[oldId]=i;return m},{});
/* বইয়ের ক্রমে সাজানো পাঠ; আইডি নতুন করে ০..৩৮ বসানো হয় যাতে সূচক ও আইডি এক থাকে */
/* শিরোনামে পুরনো "পাঠ ২৩ — " নম্বরটি আর ঠিক থাকে না (ক্রম বদলেছে), তাই সেটি
   ছেঁটে ফেলা হয় — নম্বর এখন বইয়ের অবস্থান থেকেই দেখানো হয়। */
const stripNo = (t)=>String(t||"").replace(/^পাঠ\s*[০-৯]+[কখ]?\s*—\s*/,"");
export const UNITS = BOOK_ORDER.map((oldId,i)=>{
  const raw = RAW_UNITS.find(u=>u.id===oldId);
  return Object.assign({},raw,{id:i,oldId,title:stripNo(raw.title)});
});


export function allDone(s,a,b){for(let i=a;i<=b;i++){if(!((s.crowns[i]||0)>0))return false}return true}
/* ════════ গল্প — বই থেকে সরাসরি নেওয়া কাহিনী ════════
   afterId পুরনো আইডিতে লেখা; নিচে বইয়ের নতুন ক্রমে বসিয়ে নেওয়া হয়। */
export const STORIES = RAW_STORIES
  .map((s)=>Object.assign({},s,{afterId:NEW_OF_OLD[s.afterId]}))
  .sort((a,b)=>a.afterId-b.afterId);
export const BADGES=[
 {id:"first",emo:"🌱",nm:"প্রথম পদক্ষেপ",desc:"প্রথম পাঠ শেষ করো",chk:s=>s.lessonsDone>=1},
 {id:"streak3",emo:"🔥",nm:"৩ দিনের ধারা",desc:"টানা ৩ দিন শেখো",chk:s=>s.bestStreak>=3},
 {id:"streak7",emo:"🌋",nm:"৭ দিনের ধারা",desc:"টানা ৭ দিন শেখো",chk:s=>s.bestStreak>=7},
 {id:"w50",emo:"📚",nm:"শব্দবীর",desc:"৫০টি শব্দ শেখো",chk:s=>Object.keys(s.words).length>=50},
 {id:"w100",emo:"🎓",nm:"শব্দসম্রাট",desc:"১০০টি শব্দ শেখো",chk:s=>Object.keys(s.words).length>=100},
 {id:"flash1",emo:"🃏",nm:"ফ্ল্যাশকার্ড শুরু",desc:"একটি ফ্ল্যাশকার্ড সেশন শেষ করো",chk:s=>(s.flashDone||0)>=1},
 {id:"star20",emo:"⭐",nm:"মুখস্থের তারা",desc:"২০টি শব্দে ৩ তারা অর্জন করো",chk:s=>Object.values(s.wordStars||{}).filter(v=>v>=3).length>=20},
 {id:"perf5",emo:"💯",nm:"নিখুঁত ৫",desc:"৫টি নিখুঁত পাঠ",chk:s=>s.perfect>=5},
 {id:"cr10",emo:"👑",nm:"মুকুটধারী",desc:"১০টি মুকুট জেতো",chk:s=>totalCrowns(s)>=10},
 {id:"cr30",emo:"🏰",nm:"মুকুট-সম্রাট",desc:"৫০টি মুকুট জেতো",chk:s=>totalCrowns(s)>=50},
 {id:"xp1k",emo:"⚡",nm:"বিদ্যুৎগতি",desc:"১০০০ XP অর্জন",chk:s=>s.xp>=1000},
 {id:"sec1",emo:"🌱",nm:"প্রথম সোপান",desc:"১ম খণ্ডের প্রথম অধ্যায় শেষ করো",chk:s=>allDone(s,0,10)},
 {id:"sec2",emo:"🌿",nm:"শব্দের সাগর",desc:"১ম খণ্ডের দ্বিতীয় অধ্যায় শেষ করো",chk:s=>allDone(s,11,17)},
 {id:"sec3",emo:"🌳",nm:"ক্রিয়ার কারিগর",desc:"২য় খণ্ডের সব পাঠ শেষ করো",chk:s=>allDone(s,19,32)},
 {id:"sec4",emo:"🕌",nm:"উচ্চতর সোপান",desc:"৩য় খণ্ডের সব পাঠ শেষ করো",chk:s=>allDone(s,33,38)},
 {id:"khatm",emo:"🏆",nm:"পূর্ণ কিতাব",desc:"গোটা কিতাবের সব পাঠ শেষ করো",chk:s=>allDone(s,0,38)},
 {id:"w300",emo:"📜",nm:"ভাষাবিদ",desc:"৩০০টি শব্দ শেখো",chk:s=>Object.keys(s.words).length>=300},
 {id:"stories",emo:"🧞",nm:"গল্পপ্রেমী",desc:"সবগুলো গল্প পড়ো",chk:s=>STORIES.every(st=>s.storiesDone&&s.storiesDone[st.id])}
];
export const LEVELS=[{t:"নবীন তালিবে ইলম",e:"🌱"},{t:"আগ্রহী শিক্ষার্থী",e:"📖"},{t:"পরিশ্রমী তালিব",e:"✏️"},{t:"মেধাবী ছাত্র",e:"🌟"},{t:"আরবির বন্ধু",e:"🕌"},{t:"ভাষা-অভিযাত্রী",e:"🧭"},{t:"দক্ষ তালিবে ইলম",e:"🎓"},{t:"আরবি-বিশারদ",e:"👑"}];
export const RIVALS=["সাঈদ","খাদীজা","বিলাল","ফাতেমা","মাজেদ","যাইনাব","খালেদ","ফারহানা","মাহমুদ"];
export function totalCrowns(s){return Object.values(s.crowns).reduce((a,b)=>a+b,0)}
