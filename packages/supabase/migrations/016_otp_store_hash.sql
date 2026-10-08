-- ============================================================
-- MistriJi — 016_otp_store_hash.sql
-- Purpose: Update otp_store table to store SHA-256 code_hash instead of plaintext code
-- ============================================================

CREATE TABLE IF NOT EXISTS public.otp_store (
  identifier TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE public.otp_store ENABLE ROW LEVEL SECURITY;

-- Restrict direct client access completely (handled via backend service role)
CREATE POLICY "No direct client access to otp_store"
  ON public.otp_store FOR ALL
  USING (FALSE);
