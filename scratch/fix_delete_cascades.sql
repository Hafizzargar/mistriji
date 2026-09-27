-- ============================================================
-- FIX: Allow DELETE on all tables (bypass role-based RLS for delete)
-- The admin panel uses custom auth (not Supabase Auth), so
-- auth.uid() is NULL and get_my_role() returns 'anon'.
-- This means ALL delete policies silently fail (0 rows deleted).
-- Fix: Change delete policies to USING (TRUE) for prototype.
-- ============================================================

-- 1. USERS
DROP POLICY IF EXISTS "users: delete" ON public.users;
CREATE POLICY "users: delete" ON public.users FOR DELETE USING (TRUE);

-- 2. PROFILES
DROP POLICY IF EXISTS "profiles: delete" ON public.profiles;
CREATE POLICY "profiles: delete" ON public.profiles FOR DELETE USING (TRUE);

-- 3. WORKER PROFILES
DROP POLICY IF EXISTS "worker_profiles: delete" ON public.worker_profiles;
CREATE POLICY "worker_profiles: delete" ON public.worker_profiles FOR DELETE USING (TRUE);

-- 4. WORKER SKILLS
DROP POLICY IF EXISTS "worker_skills: delete" ON public.worker_skills;
CREATE POLICY "worker_skills: delete" ON public.worker_skills FOR DELETE USING (TRUE);

-- 5. JOBS
DROP POLICY IF EXISTS "jobs: delete" ON public.jobs;
CREATE POLICY "jobs: delete" ON public.jobs FOR DELETE USING (TRUE);

-- 6. RATINGS
DROP POLICY IF EXISTS "ratings: delete" ON public.ratings;
DROP POLICY IF EXISTS "Admins can delete ratings" ON public.ratings;
CREATE POLICY "ratings: delete" ON public.ratings FOR DELETE USING (TRUE);

-- 7. JOB CLAIMS
DROP POLICY IF EXISTS "Admins can delete claims" ON public.job_claims;
CREATE POLICY "job_claims: delete" ON public.job_claims FOR DELETE USING (TRUE);

-- 8. SUPPORT MESSAGES
DROP POLICY IF EXISTS "Admins can delete support messages" ON public.support_messages;
CREATE POLICY "support_messages: delete" ON public.support_messages FOR DELETE USING (TRUE);

-- 9. NOTIFICATIONS
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
CREATE POLICY "notifications: delete" ON public.notifications FOR DELETE USING (TRUE);

-- 10. EMPLOYER WORKERS
DROP POLICY IF EXISTS "employer_workers: delete" ON public.employer_workers;
CREATE POLICY "employer_workers: delete" ON public.employer_workers FOR DELETE USING (TRUE);
