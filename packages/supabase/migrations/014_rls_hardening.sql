-- ============================================================
-- Migration: RLS Hardening (Security Fixes)
-- Purpose: Locks down unauthorized role elevation and cross-row updates
-- ============================================================

-- 1. USERS TABLE FIXES
DROP POLICY IF EXISTS "users: update" ON public.users;
DROP POLICY IF EXISTS "users: update own row" ON public.users;

-- Users can only update their OWN row, and cannot elevate themselves to admin/super_admin.
-- Admins and Superadmins can update anyone.
CREATE POLICY "users: update secure" ON public.users FOR UPDATE
USING (
  id = get_my_user_id() 
  OR get_my_role() IN ('admin', 'super_admin')
)
WITH CHECK (
  (
    id = get_my_user_id() 
    AND role NOT IN ('admin', 'super_admin') -- Prevents self-elevation to admin
  )
  OR get_my_role() IN ('admin', 'super_admin')
);


-- 2. PROFILES TABLE FIXES
DROP POLICY IF EXISTS "profiles: update" ON public.profiles;

-- Users can only update their own profile
CREATE POLICY "profiles: update secure" ON public.profiles FOR UPDATE
USING (
  user_id = get_my_user_id() 
  OR get_my_role() IN ('admin', 'super_admin')
)
WITH CHECK (
  user_id = get_my_user_id() 
  OR get_my_role() IN ('admin', 'super_admin')
);


-- 3. JOBS TABLE FIXES (Prevent Cross-Row Updates)
DROP POLICY IF EXISTS "jobs: customer cancel" ON public.jobs;
DROP POLICY IF EXISTS "jobs: worker update status" ON public.jobs;

CREATE POLICY "jobs: customer cancel secure" ON public.jobs FOR UPDATE
USING (
  customer_id = get_my_user_id()
  AND status = 'requested'
)
WITH CHECK (
  customer_id = get_my_user_id() -- Ensures they don't transfer the job to another customer
);

CREATE POLICY "jobs: worker update status secure" ON public.jobs FOR UPDATE
USING (worker_id = get_my_user_id())
WITH CHECK (worker_id = get_my_user_id()); -- Ensures they don't assign it to another worker


-- 4. EMPLOYER_WORKERS TABLE FIXES
DROP POLICY IF EXISTS "employer_workers: employer update" ON public.employer_workers;

CREATE POLICY "employer_workers: employer update secure" ON public.employer_workers FOR UPDATE
USING (employer_id = get_my_user_id())
WITH CHECK (employer_id = get_my_user_id());


-- 5. AUDIT LOGS FIX (Allow frontend inserts)
DROP POLICY IF EXISTS "audit_logs: no direct client insert" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs: frontend insert" ON public.audit_logs;

CREATE POLICY "audit_logs: frontend insert" ON public.audit_logs FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' -- Ensures only logged-in users (including admins) can log audits
  OR get_my_role() IN ('admin', 'super_admin')
);
