-- ============================================================
-- MistriJi — 006_add_suspension_reason.sql
-- Add suspension_reason column to users table
-- ============================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
