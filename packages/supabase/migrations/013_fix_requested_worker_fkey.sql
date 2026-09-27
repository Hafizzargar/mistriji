
-- ============================================================
-- MistriJi — 013_fix_requested_worker_fkey.sql
-- Fix foreign key constraint for requested_worker_id to allow worker deletion
-- ============================================================

-- Drop the existing constraint (Supabase usually names it jobs_requested_worker_id_fkey)
ALTER TABLE public.jobs 
  DROP CONSTRAINT IF EXISTS jobs_requested_worker_id_fkey;

-- Re-add the constraint with ON DELETE SET NULL
ALTER TABLE public.jobs 
  ADD CONSTRAINT jobs_requested_worker_id_fkey 
  FOREIGN KEY (requested_worker_id) 
  REFERENCES public.users(id) 
  ON DELETE SET NULL;
