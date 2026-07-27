/* ════════ কণ্ঠ-চিনন (Speech Recognition) ════════
   ব্রাউজারের Web Speech API দিয়ে শিক্ষার্থীর আরবি উচ্চারণ টেক্সটে রূপান্তর করে।
   সব ব্রাউজারে থাকে না (Chrome/Edge/সাম্প্রতিক Safari-তে আছে) — না থাকলে
   speechSupported() false দেয়, তখন 'বলো' অনুশীলন তৈরিই হয় না। */

export function speechSupported() {
  return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/* একবার শোনে, ফলাফল/ভুল কলব্যাকে জানায়। ফিরিয়ে দেওয়া অবজেক্টে stop() আছে। */
export function listenArabic({ onResult, onError, onEnd }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { onError && onError("unsupported"); return { stop() {} }; }
  let rec;
  try { rec = new SR(); } catch { onError && onError("init"); return { stop() {} }; }
  rec.lang = "ar-SA";
  rec.interimResults = false;
  rec.maxAlternatives = 4;      // কয়েকটি বিকল্প — মিল বাড়াতে
  rec.continuous = false;
  let done = false;
  rec.onresult = (e) => {
    done = true;
    const alts = [];
    try { for (const r of e.results[0]) alts.push(r.transcript); } catch { /* ignore */ }
    onResult && onResult(alts);
  };
  rec.onerror = (e) => { done = true; onError && onError((e && e.error) || "error"); };
  rec.onend = () => { onEnd && onEnd(done); };
  try { rec.start(); } catch { onError && onError("start"); }
  return { stop() { try { rec.stop(); } catch { /* ignore */ } } };
}
