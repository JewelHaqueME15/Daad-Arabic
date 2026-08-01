import { requireUser } from "../lib/auth.js";
import { upsertProgress, getProgress } from "../lib/db.js";

// Safety net. A client bug once caused a freshly-defaulted (empty) state to be
// autosaved over an account's real progress. Anything that would blank out a
// non-empty account is rejected unless the client explicitly says this is the
// user asking to reset ("সব প্রগ্রেস মুছে ফেলো").
function looksEmpty(s) {
  return Number(s.xp || 0) === 0 && Number(s.lessonsDone || 0) === 0 &&
         Object.keys(s.crowns || {}).length === 0 && Object.keys(s.words || {}).length === 0;
}

export default async function handler(req, res) {
  if (req.method !== "PUT") return res.status(405).json({ error: "method not allowed" });
  const session = await requireUser(req, res);
  if (!session) return; // requireUser already sent 401

  const { state, reset } = req.body || {};
  if (!state || typeof state !== "object") return res.status(400).json({ error: "state must be an object" });

  if (!reset && looksEmpty(state)) {
    const prev = await getProgress(session.id);
    if (prev && !looksEmpty(prev)) {
      return res.status(409).json({ error: "refusing to overwrite existing progress with an empty state" });
    }
  }

  await upsertProgress(session.id, state);
  return res.status(200).json({ ok: true });
}
