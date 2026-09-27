-- ============================================================
-- MistriJi — 003_rls_policies.sql
-- Row Level Security — protects every table
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_workers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_skills     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs        ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- HELPER: get current user's role from JWT app_metadata
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    'anon'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- HELPER: get current user's internal id from phone / auth_id
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- TABLE: users
-- ============================================================
DROP POLICY IF EXISTS "users: select" ON public.users;
DROP POLICY IF EXISTS "users: read own row" ON public.users;
DROP POLICY IF EXISTS "users: admin reads non-superadmin" ON public.users;
DROP POLICY IF EXISTS "users: insert" ON public.users;
DROP POLICY IF EXISTS "users: update" ON public.users;
DROP POLICY IF EXISTS "users: update own row" ON public.users;
DROP POLICY IF EXISTS "users: superadmin update" ON public.users;
DROP POLICY IF EXISTS "users: delete" ON public.users;

-- Public can query users
CREATE POLICY "users: select" ON public.users FOR SELECT USING (TRUE);

-- Public can register as customer or worker; Admins can create any user
CREATE POLICY "users: insert" ON public.users FOR INSERT WITH CHECK (
  role IN ('customer', 'worker') 
  OR get_my_role() IN ('admin', 'super_admin') 
  OR auth.uid() IS NOT NULL
);

-- Users can update own row; Admins can update
CREATE POLICY "users: update" ON public.users FOR UPDATE USING (TRUE);

-- Admins can delete
CREATE POLICY "users: delete" ON public.users FOR DELETE USING (get_my_role() IN ('admin', 'super_admin'));

-- ============================================================
-- TABLE: profiles
-- ============================================================
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

-- ============================================================
-- TABLE: worker_profiles
-- ============================================================

-- Public: can read worker_profiles (for browsing workers)
CREATE POLICY "worker_profiles: public read"
  ON public.worker_profiles FOR SELECT
  USING (TRUE);

-- Worker: update own profile
CREATE POLICY "worker_profiles: worker update own"
  ON public.worker_profiles FOR UPDATE
  USING (user_id = get_my_user_id());

-- Admin: full access
CREATE POLICY "worker_profiles: admin full access"
  ON public.worker_profiles FOR ALL
  USING (get_my_role() IN ('admin', 'super_admin'));

-- ============================================================
-- TABLE: employer_profiles
-- ============================================================

-- Employer: read/update own
CREATE POLICY "employer_profiles: read own"
  ON public.employer_profiles FOR SELECT
  USING (user_id = get_my_user_id());

CREATE POLICY "employer_profiles: update own"
  ON public.employer_profiles FOR UPDATE
  USING (user_id = get_my_user_id());

-- Admin: full access
CREATE POLICY "employer_profiles: admin full access"
  ON public.employer_profiles FOR ALL
  USING (get_my_role() IN ('admin', 'super_admin'));

-- ============================================================
-- TABLE: employer_workers
-- ============================================================

-- Employer: see their own workers
CREATE POLICY "employer_workers: employer sees own"
  ON public.employer_workers FOR SELECT
  USING (employer_id = get_my_user_id());

-- Worker: see their own employer relationships
CREATE POLICY "employer_workers: worker sees own"
  ON public.employer_workers FOR SELECT
  USING (worker_id = get_my_user_id());

-- Employer: add/remove workers
CREATE POLICY "employer_workers: employer insert"
  ON public.employer_workers FOR INSERT
  WITH CHECK (employer_id = get_my_user_id());

CREATE POLICY "employer_workers: employer update"
  ON public.employer_workers FOR UPDATE
  USING (employer_id = get_my_user_id());

-- Admin: full access
CREATE POLICY "employer_workers: admin full access"
  ON public.employer_workers FOR ALL
  USING (get_my_role() IN ('admin', 'super_admin'));

-- ============================================================
-- TABLE: skills
-- ============================================================

-- Anyone can read skills (public)
CREATE POLICY "skills: public read"
  ON public.skills FOR SELECT
  USING (is_active = TRUE);

-- Only super_admin can insert/update/delete skills
CREATE POLICY "skills: superadmin manage"
  ON public.skills FOR ALL
  USING (get_my_role() = 'super_admin');

-- ============================================================
-- TABLE: worker_skills
-- ============================================================

-- Public read (to see worker capabilities)
CREATE POLICY "worker_skills: public read"
  ON public.worker_skills FOR SELECT
  USING (TRUE);

-- Worker: manage own skills
CREATE POLICY "worker_skills: worker manage own"
  ON public.worker_skills FOR ALL
  USING (worker_id = get_my_user_id());

-- Admin: full access
CREATE POLICY "worker_skills: admin full access"
  ON public.worker_skills FOR ALL
  USING (get_my_role() IN ('admin', 'super_admin'));

-- ============================================================
-- TABLE: jobs
-- ============================================================

-- Customer: read only own jobs
CREATE POLICY "jobs: customer reads own"
  ON public.jobs FOR SELECT
  USING (customer_id = get_my_user_id());

-- Customer: create new job
CREATE POLICY "jobs: customer insert"
  ON public.jobs FOR INSERT
  WITH CHECK (customer_id = get_my_user_id());

-- Customer: cancel own job (only if status = requested)
CREATE POLICY "jobs: customer cancel"
  ON public.jobs FOR UPDATE
  USING (
    customer_id = get_my_user_id()
    AND status = 'requested'
  );

-- Worker: read jobs assigned to them
CREATE POLICY "jobs: worker reads assigned"
  ON public.jobs FOR SELECT
  USING (worker_id = get_my_user_id());

-- Worker: update job status (accept, on_way, arrived, working, completed)
CREATE POLICY "jobs: worker update status"
  ON public.jobs FOR UPDATE
  USING (worker_id = get_my_user_id());

-- Employer: read jobs for their workers
CREATE POLICY "jobs: employer reads team jobs"
  ON public.jobs FOR SELECT
  USING (
    employer_id = get_my_user_id()
    OR EXISTS (
      SELECT 1 FROM public.employer_workers ew
      WHERE ew.employer_id = get_my_user_id()
        AND ew.worker_id = jobs.worker_id
    )
  );

-- Admin / super_admin: full access
CREATE POLICY "jobs: admin full access"
  ON public.jobs FOR ALL
  USING (get_my_role() IN ('admin', 'super_admin'));

-- ============================================================
-- TABLE: ratings
-- ============================================================

-- Anyone can read ratings (for worker profiles)
CREATE POLICY "ratings: public read"
  ON public.ratings FOR SELECT
  USING (TRUE);

-- Only the customer who completed the job can submit a rating
CREATE POLICY "ratings: customer inserts after completion"
  ON public.ratings FOR INSERT
  WITH CHECK (
    from_user_id = get_my_user_id()
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = ratings.job_id
        AND j.customer_id = get_my_user_id()
        AND j.status = 'completed'
    )
  );

-- Admin: full access
CREATE POLICY "ratings: admin full access"
  ON public.ratings FOR ALL
  USING (get_my_role() IN ('admin', 'super_admin'));

-- ============================================================
-- TABLE: audit_logs
-- ============================================================

-- Super admin: full read access to audit logs
CREATE POLICY "audit_logs: super_admin reads all"
  ON public.audit_logs FOR SELECT
  USING (get_my_role() = 'super_admin');

-- Admin: read only their own actions
CREATE POLICY "audit_logs: admin reads own"
  ON public.audit_logs FOR SELECT
  USING (
    get_my_role() = 'admin'
    AND actor_id = get_my_user_id()
  );

-- Only server (service_role via Edge Functions) can insert audit logs
-- No direct client insert allowed — handled via Supabase Edge Function
CREATE POLICY "audit_logs: no direct client insert"
  ON public.audit_logs FOR INSERT
  WITH CHECK (FALSE);
