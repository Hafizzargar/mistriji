-- ============================================================
-- MistriJi - 015_add_suspension_expiry.sql
-- Add suspension_expiry column to users table
-- ============================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspension_expiry TIMESTAMPTZ;
