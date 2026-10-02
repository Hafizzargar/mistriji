-- Run this script in the Supabase Dashboard SQL Editor
-- This adds the new contact_name and contact_phone columns to the jobs table

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;
