// Thin fetch wrappers around the /api/* backend. Every call sends/receives
// the httpOnly session cookie automatically (same-origin, credentials
// default to "same-origin" which is what fetch already does for same-origin
// requests, kept explicit here for clarity).

// ডাটাবেস অলস অবস্থায় থাকলে (Neon ফ্রি টিয়ার ঘুমিয়ে যায়) প্রথম অনুরোধ ধীর হতে
// পারে। টাইমআউট না থাকলে অ্যাপ চিরকাল ঝুলে থাকে — তাই ২৫ সেকেন্ডে থামিয়ে
// পরিষ্কার বার্তা দেখানো হয়।
const REQUEST_TIMEOUT_MS = 25000;

async function request(url, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      signal: ctl.signal,
      ...opts,
    });
  } catch (e) {
    clearTimeout(timer);
    const err = new Error(e && e.name === "AbortError"
      ? "সার্ভার সাড়া দিচ্ছে না — ইন্টারনেট দেখে আবার চেষ্টা করো"
      : "সংযোগ করা যাচ্ছে না — ইন্টারনেট দেখে আবার চেষ্টা করো");
    err.offline = true;
    throw err;
  }
  clearTimeout(timer);
  let body = null;
  try { body = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const err = new Error((body && body.error) || `request failed: ${res.status}`);
    err.status = res.status;
    // "এই নাম/ইমেইলে অ্যাকাউন্ট নেই" — শুধু তখনই নতুন অ্যাকাউন্ট খোলার প্রস্তাব
    err.notFound = !!(body && body.notFound);
    throw err;
  }
  return body;
}

export function signup({ username, password, wantsAdmin, adminCode }) {
  return request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, password, wantsAdmin, adminCode }),
  });
}

export function login({ username, email, password }) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

/* ইমেইল + পাসওয়ার্ডে নতুন অ্যাকাউন্ট */
export function register({ email, password, name, wantsAdmin, adminCode }) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name, wantsAdmin, adminCode }),
  });
}

/* গুগল সাইন-ইন — ব্রাউজার থেকে পাওয়া ID টোকেন সার্ভারে যাচাই হয় */
export function googleLogin(credential) {
  return request("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export function config() {
  return request("/api/config", { method: "GET" });
}

export function logout() {
  return request("/api/auth/logout", { method: "POST" });
}

export function me() {
  return request("/api/me", { method: "GET" });
}

/* reset=true শুধু তখনই, যখন ব্যবহারকারী নিজে "সব প্রগ্রেস মুছে ফেলো" চাপে —
   নইলে সার্ভার ফাঁকা state দিয়ে আগের অগ্রগতি মুছতে দেয় না (নিরাপত্তা জাল)। */
export function saveState(state, { reset = false } = {}) {
  return request("/api/state", {
    method: "PUT",
    body: JSON.stringify({ state, reset }),
  });
}

export function migrate({ username, password, wantsAdmin, adminCode, localState }) {
  return request("/api/migrate", {
    method: "POST",
    body: JSON.stringify({ username, password, wantsAdmin, adminCode, localState }),
  });
}

export function leaderboard() {
  return request("/api/leaderboard", { method: "GET" });
}

export function ttsUrl(text) {
  return "/api/tts?q=" + encodeURIComponent(text);
}
