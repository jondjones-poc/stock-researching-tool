-- Google sign-in allowlist (run in Supabase SQL editor)
CREATE TABLE IF NOT EXISTS auth_allowed_email (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_allowed_email_lower ON auth_allowed_email (LOWER(email));
