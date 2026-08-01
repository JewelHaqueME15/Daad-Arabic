import { googleClientId } from "../lib/auth.js";

// Public front-end config. The Google client ID is not a secret (it ships in
// the page for any Google Sign-In button); serving it from here lets the app
// hide the Google button entirely when it has not been configured yet.
export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).json({ googleClientId: googleClientId() });
}
