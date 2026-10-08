-- ============================================================
-- MistriJi — 016_otp_store_hash.sql
-- Purpose: Migrate otp_store table to store SHA-256 code_hash instead of plaintext code
-- ============================================================

CREATE TABLE IF NOT EXISTS public.otp_store (
  identifier TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE
);

-- Safe migration for existing tables that had plaintext 'code' column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'otp_store' AND column_name = 'code') THEN
    ALTER TABLE public.otp_store DROP COLUMN code;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'otp_store' AND column_name = 'code_hash') THEN
    ALTER TABLE public.otp_store ADD COLUMN code_hash TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.otp_store ENABLE ROW LEVEL SECURITY;

-- Restrict direct client access completely (handled via backend service role)
DROP POLICY IF EXISTS "No direct client access to otp_store" ON public.otp_store;
CREATE POLICY "No direct client access to otp_store"
  ON public.otp_store FOR ALL
  USING (FALSE);
