-- Fix foreign key constraints on the jobs table to allow deleting jobs
-- Run this in the Supabase SQL Editor

ALTER TABLE public.ratings 
DROP CONSTRAINT IF EXISTS ratings_job_id_fkey,
ADD CONSTRAINT ratings_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

ALTER TABLE public.job_claims 
DROP CONSTRAINT IF EXISTS job_claims_job_id_fkey,
ADD CONSTRAINT job_claims_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

-- If notifications had an accidental FK constraint, remove it:
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_reference_id_fkey;
