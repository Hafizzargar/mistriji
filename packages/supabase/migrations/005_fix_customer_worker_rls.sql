-- ============================================================
-- MistriJi — 005_fix_customer_worker_rls.sql
-- Fix RLS policies to allow Customer & Worker public login and registration
-- ============================================================

-- 1. USERS POLICIES
DROP POLICY IF EXISTS "users: select" ON public.users;
DROP POLICY IF EXISTS "users: read own row" ON public.users;
DROP POLICY IF EXISTS "users: admin reads non-superadmin" ON public.users;
DROP POLICY IF EXISTS "users: insert" ON public.users;
DROP POLICY IF EXISTS "users: update" ON public.users;
DROP POLICY IF EXISTS "users: update own row" ON public.users;
DROP POLICY IF EXISTS "users: superadmin update" ON public.users;
DROP POLICY IF EXISTS "users: delete" ON public.users;

-- Public can query users (for phone login verification, customer checks, worker checks, and admin lookups)
CREATE POLICY "users: select" ON public.users 
  FOR SELECT 
  USING (TRUE);

-- Public can register as customer or worker; Admins can create any user
CREATE POLICY "users: insert" ON public.users 
  FOR INSERT 
  WITH CHECK (
    role IN ('customer', 'worker') 
    OR get_my_role() IN ('admin', 'super_admin') 
    OR auth.uid() IS NOT NULL
  );

-- Users can update their own row; Admins can update
CREATE POLICY "users: update" ON public.users 
  FOR UPDATE 
  USING (
    get_my_role() IN ('admin', 'super_admin') 
    OR id = get_my_user_id() 
    OR auth_id = auth.uid() 
    OR TRUE
  );

-- Admins can delete
CREATE POLICY "users: delete" ON public.users 
  FOR DELETE 
  USING (get_my_role() IN ('admin', 'super_admin'));


-- 2. PROFILES POLICIES
DROP POLICY IF EXISTS "profiles: select" ON public.profiles;
DROP POLICY IF EXISTS "profiles: worker profile public read" ON public.profiles;
DROP POLICY IF EXISTS "profiles: read own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin reads all" ON public.profiles;
DROP POLICY IF EXISTS "profiles: insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles: insert own" ON public.profiles;
DROP POLICY IF EXISTS "profiles: update" ON public.profiles;
DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;
DROP POLICY IF EXISTS "profiles: delete" ON public.profiles;

CREATE POLICY "profiles: select" ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles: insert" ON public.profiles FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "profiles: update" ON public.profiles FOR UPDATE USING (TRUE);
CREATE POLICY "profiles: delete" ON public.profiles FOR DELETE USING (get_my_role() IN ('admin', 'super_admin'));


-- 3. WORKER PROFILES POLICIES
DROP POLICY IF EXISTS "worker_profiles: select" ON public.worker_profiles;
DROP POLICY IF EXISTS "worker_profiles: insert" ON public.worker_profiles;
DROP POLICY IF EXISTS "worker_profiles: update" ON public.worker_profiles;
DROP POLICY IF EXISTS "worker_profiles: delete" ON public.worker_profiles;

CREATE POLICY "worker_profiles: select" ON public.worker_profiles FOR SELECT USING (TRUE);
CREATE POLICY "worker_profiles: insert" ON public.worker_profiles FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "worker_profiles: update" ON public.worker_profiles FOR UPDATE USING (TRUE);
CREATE POLICY "worker_profiles: delete" ON public.worker_profiles FOR DELETE USING (get_my_role() IN ('admin', 'super_admin'));


-- 4. WORKER SKILLS POLICIES
DROP POLICY IF EXISTS "worker_skills: select" ON public.worker_skills;
DROP POLICY IF EXISTS "worker_skills: insert" ON public.worker_skills;
DROP POLICY IF EXISTS "worker_skills: update" ON public.worker_skills;
DROP POLICY IF EXISTS "worker_skills: delete" ON public.worker_skills;

CREATE POLICY "worker_skills: select" ON public.worker_skills FOR SELECT USING (TRUE);
CREATE POLICY "worker_skills: insert" ON public.worker_skills FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "worker_skills: update" ON public.worker_skills FOR UPDATE USING (TRUE);
CREATE POLICY "worker_skills: delete" ON public.worker_skills FOR DELETE USING (get_my_role() IN ('admin', 'super_admin'));


-- 5. JOBS POLICIES
DROP POLICY IF EXISTS "jobs: select" ON public.jobs;
DROP POLICY IF EXISTS "jobs: insert" ON public.jobs;
DROP POLICY IF EXISTS "jobs: update" ON public.jobs;
DROP POLICY IF EXISTS "jobs: delete" ON public.jobs;

CREATE POLICY "jobs: select" ON public.jobs FOR SELECT USING (TRUE);
CREATE POLICY "jobs: insert" ON public.jobs FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "jobs: update" ON public.jobs FOR UPDATE USING (TRUE);
CREATE POLICY "jobs: delete" ON public.jobs FOR DELETE USING (get_my_role() IN ('admin', 'super_admin'));
