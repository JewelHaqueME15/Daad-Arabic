-- Email + Google sign-in support.
--
-- You normally do NOT need to run this by hand: lib/db.js `ensureAuthSchema()`
-- applies exactly these statements once per cold start, and every one of them
-- is idempotent. It is kept here so the schema is documented in one place and
-- can be applied manually (e.g. from the Neon "Query" tab) if preferred.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;

-- Google accounts have no password.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- One account per email / per Google user. Partial indexes so the many legacy
-- name-only rows (email IS NULL) do not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx
  ON users (google_sub) WHERE google_sub IS NOT NULL;
