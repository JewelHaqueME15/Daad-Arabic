// Proxies Google's unofficial translate_tts endpoint server-side so the
// browser never talks to a third-party scraping URL directly, and so
// repeated words (the same vocab item spoken many times) get cached by the
// browser/edge instead of re-hitting Google every time.
//
// The endpoint rejects requests that omit the client-side params it expects
// (textlen / idx / total), which showed up as random dropouts mid-lesson, so
// they are always sent. The client splits long text into <=170-char chunks;
// the 200-char cap here is just a safety net.
const UPSTREAM = "https://translate.google.com/translate_tts";

function upstreamUrl(text) {
  const q = new URLSearchParams({
    ie: "UTF-8",
    tl: "ar",
    client: "tw-ob",
    total: "1",
    idx: "0",
    textlen: String([...text].length),
    q: text,
  });
  return `${UPSTREAM}?${q.toString()}`;
}

async function fetchAudio(text) {
  return fetch(upstreamUrl(text), {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
      "Accept": "audio/mpeg, audio/*;q=0.9, */*;q=0.5",
      "Accept-Language": "ar,en;q=0.8",
      "Referer": "https://translate.google.com/",
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });

  const text = (req.query.q || "").toString().slice(0, 200);
  if (!text) return res.status(400).json({ error: "missing q" });

  // One retry: the upstream intermittently 5xx/403s, and a silent failure
  // here is what the learner hears as audio "breaking down".
  let upstream = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      upstream = await fetchAudio(text);
      if (upstream.ok) break;
    } catch {
      upstream = null;
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 150));
  }
  if (!upstream) return res.status(502).json({ error: "tts upstream unreachable" });
  if (!upstream.ok) return res.status(502).json({ error: "tts upstream failed" });

  const buf = Buffer.from(await upstream.arrayBuffer());
  if (!buf.length) return res.status(502).json({ error: "tts upstream empty" });

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Content-Length", String(buf.length));
  res.setHeader("Accept-Ranges", "bytes");
  // A word's audio never changes — cache hard so repeats are instant and offline-ish.
  res.setHeader("Cache-Control", "public, max-age=2592000, s-maxage=2592000, immutable");
  return res.status(200).send(buf);
}
