-- ============================================================
-- MistriJi — Complete Database & Security Setup Script
-- Paste this script directly into Supabase SQL Editor and click RUN
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- SECTION 1: ENUM TYPES
-- ─────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('customer', 'worker', 'employer', 'admin', 'super_admin');
CREATE TYPE account_status AS ENUM ('active', 'pending', 'suspended', 'deleted');
CREATE TYPE phone_type AS ENUM ('smartphone', 'keypad', 'none');
CREATE TYPE enrollment_method AS ENUM ('field', 'self_call', 'employer', 'sms', 'app');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE employer_worker_status AS ENUM ('active', 'inactive', 'removed');
CREATE TYPE job_status AS ENUM ('requested', 'accepted', 'on_way', 'arrived', 'working', 'completed', 'cancelled');
CREATE TYPE payment_method AS ENUM ('cash', 'upi', 'pending');
CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded');

-- ─────────────────────────────────────────────────────────────
-- SECTION 2: TABLES & INDEXES
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id       UUID UNIQUE,
  phone         TEXT UNIQUE NOT NULL,
  role          user_role NOT NULL DEFAULT 'customer',
  status        account_status NOT NULL DEFAULT 'active',
  pin_hash      TEXT,
  suspension_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.profiles (
  user_id       UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  photo_url     TEXT,
  area          TEXT,
  district      TEXT,
  pincode       TEXT,
  city          TEXT NOT NULL DEFAULT 'Jammu',
  lat           DECIMAL(9,6),
  lng           DECIMAL(9,6),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.worker_profiles (
  user_id              UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  experience_years     INT NOT NULL DEFAULT 0 CHECK (experience_years >= 0 AND experience_years <= 50),
  is_available         BOOLEAN NOT NULL DEFAULT TRUE,
  verification_status  verification_status NOT NULL DEFAULT 'pending',
  phone_type           phone_type NOT NULL DEFAULT 'smartphone',
  enrollment_method    enrollment_method NOT NULL DEFAULT 'app',
  claimed              BOOLEAN NOT NULL DEFAULT TRUE,
  id_proof_url         TEXT,
  lat                  DECIMAL(9,6),
  lng                  DECIMAL(9,6),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.employer_profiles (
  user_id        UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  business_name  TEXT,
  is_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.employer_workers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  worker_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status        employer_worker_status NOT NULL DEFAULT 'active',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employer_id, worker_id)
);

CREATE TABLE public.skills (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT UNIQUE NOT NULL,
  name_hi     TEXT,
  icon        TEXT,
  category    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.worker_skills (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  skill_id         UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  experience_years INT NOT NULL DEFAULT 0,
  UNIQUE(worker_id, skill_id)
);

CREATE TABLE public.jobs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  worker_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  employer_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  skill_id          UUID NOT NULL REFERENCES public.skills(id) ON DELETE RESTRICT,
  status            job_status NOT NULL DEFAULT 'requested',
  address           TEXT NOT NULL,
  area              TEXT NOT NULL,
  lat               DECIMAL(9,6),
  lng               DECIMAL(9,6),
  preferred_time    TIMESTAMPTZ,
  description       TEXT,
  price             NUMERIC(10,2),
  payment_method    payment_method NOT NULL DEFAULT 'cash',
  payment_status    payment_status NOT NULL DEFAULT 'unpaid',
  worker_lat        DECIMAL(9,6),
  worker_lng        DECIMAL(9,6),
  cancelled_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cancel_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ratings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id         UUID NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  from_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score          SMALLINT NOT NULL CHECK (score >= 1 AND score <= 5),
  comment        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  target_id    UUID,
  target_type  TEXT,
  old_value    JSONB,
  new_value    JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_phone        ON public.users(phone);
CREATE INDEX idx_users_role         ON public.users(role);
CREATE INDEX idx_jobs_customer      ON public.jobs(customer_id);
CREATE INDEX idx_jobs_worker        ON public.jobs(worker_id);
CREATE INDEX idx_jobs_status        ON public.jobs(status);
CREATE INDEX idx_jobs_created       ON public.jobs(created_at DESC);
CREATE INDEX idx_worker_skills_wid  ON public.worker_skills(worker_id);
CREATE INDEX idx_worker_skills_sid  ON public.worker_skills(skill_id);
CREATE INDEX idx_audit_logs_actor   ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_date    ON public.audit_logs(created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_worker_profiles_updated_at BEFORE UPDATE ON public.worker_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- SECTION 3: ROW LEVEL SECURITY (RLS) POLICIES & PROTECTION
-- ─────────────────────────────────────────────────────────────
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

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role::text FROM public.users WHERE auth_id = auth.uid() LIMIT 1),
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    'anon'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- USERS
DROP POLICY IF EXISTS "users: select" ON public.users;
DROP POLICY IF EXISTS "users: insert" ON public.users;
DROP POLICY IF EXISTS "users: update" ON public.users;
DROP POLICY IF EXISTS "users: delete" ON public.users;

CREATE POLICY "users: select" ON public.users FOR SELECT USING (TRUE);
CREATE POLICY "users: insert" ON public.users FOR INSERT WITH CHECK (
  role IN ('customer', 'worker') 
  OR get_my_role() IN ('admin', 'super_admin') 
  OR auth.uid() IS NOT NULL
);
CREATE POLICY "users: update" ON public.users FOR UPDATE USING (TRUE);
CREATE POLICY "users: delete" ON public.users FOR DELETE USING (get_my_role() IN ('admin', 'super_admin'));

-- PROFILES
DROP POLICY IF EXISTS "profiles: select" ON public.profiles;
DROP POLICY IF EXISTS "profiles: insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles: update" ON public.profiles;
DROP POLICY IF EXISTS "profiles: delete" ON public.profiles;

CREATE POLICY "profiles: select" ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles: insert" ON public.profiles FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "profiles: update" ON public.profiles FOR UPDATE USING (TRUE);
CREATE POLICY "profiles: delete" ON public.profiles FOR DELETE USING (get_my_role() IN ('admin', 'super_admin'));

-- WORKER PROFILES
DROP POLICY IF EXISTS "worker_profiles: select" ON public.worker_profiles;
DROP POLICY IF EXISTS "worker_profiles: insert" ON public.worker_profiles;
DROP POLICY IF EXISTS "worker_profiles: update" ON public.worker_profiles;
DROP POLICY IF EXISTS "worker_profiles: delete" ON public.worker_profiles;

CREATE POLICY "worker_profiles: select" ON public.worker_profiles FOR SELECT USING (TRUE);
CREATE POLICY "worker_profiles: insert" ON public.worker_profiles FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "worker_profiles: update" ON public.worker_profiles FOR UPDATE USING (TRUE);
CREATE POLICY "worker_profiles: delete" ON public.worker_profiles FOR DELETE USING (get_my_role() IN ('admin', 'super_admin'));

-- WORKER SKILLS
DROP POLICY IF EXISTS "worker_skills: select" ON public.worker_skills;
DROP POLICY IF EXISTS "worker_skills: insert" ON public.worker_skills;
DROP POLICY IF EXISTS "worker_skills: update" ON public.worker_skills;
DROP POLICY IF EXISTS "worker_skills: delete" ON public.worker_skills;

CREATE POLICY "worker_skills: select" ON public.worker_skills FOR SELECT USING (TRUE);
CREATE POLICY "worker_skills: insert" ON public.worker_skills FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "worker_skills: update" ON public.worker_skills FOR UPDATE USING (TRUE);
CREATE POLICY "worker_skills: delete" ON public.worker_skills FOR DELETE USING (get_my_role() IN ('admin', 'super_admin'));

-- JOBS
DROP POLICY IF EXISTS "jobs: select" ON public.jobs;
DROP POLICY IF EXISTS "jobs: insert" ON public.jobs;
DROP POLICY IF EXISTS "jobs: update" ON public.jobs;
DROP POLICY IF EXISTS "jobs: delete" ON public.jobs;

CREATE POLICY "jobs: select" ON public.jobs FOR SELECT USING (TRUE);
CREATE POLICY "jobs: insert" ON public.jobs FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "jobs: update" ON public.jobs FOR UPDATE USING (TRUE);
CREATE POLICY "jobs: delete" ON public.jobs FOR DELETE USING (get_my_role() IN ('admin', 'super_admin'));


-- SKILLS
CREATE POLICY "skills: select" ON public.skills FOR SELECT USING (is_active = TRUE OR get_my_role() IN ('admin', 'super_admin'));
CREATE POLICY "skills: admin manage" ON public.skills FOR ALL USING (get_my_role() IN ('admin', 'super_admin'));

-- ─────────────────────────────────────────────────────────────
-- SECTION 4: SEED INITIAL SKILLS
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.skills (name, name_hi, icon, category, sort_order) VALUES
  ('Electrician',     'बिजली मिस्त्री',   '⚡',  'electrical',    1),
  ('Plumber',         'प्लम्बर',           '🔧',  'plumbing',      2),
  ('AC Technician',   'AC टेक्नीशियन',    '❄️',  'appliance',     3),
  ('Mason',           'राजमिस्त्री',       '🧱',  'construction',  4),
  ('Carpenter',       'बढ़ई',             '🪚',  'construction',  5),
  ('Painter',         'पेंटर',            '🖌️',  'interior',      6),
  ('Helper',          'हेल्पर',           '👷',  'general',       7),
  ('Welder',          'वेल्डर',           '🔥',  'construction',  8),
  ('Pest Control',    'कीट नियंत्रण',     '🐛',  'cleaning',      9),
  ('House Cleaning',  'घर सफाई',          '🧹',  'cleaning',     10)
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- SECTION 5: INITIAL SUPER ADMIN USER (Phone: 6005950197, PIN: 123456)
-- ─────────────────────────────────────────────────────────────
-- 1. Update any existing user matching auth_id or phone
UPDATE public.users
SET 
  phone = '6005950197',
  role = 'super_admin'::user_role,
  status = 'active'::account_status,
  pin_hash = '123456'
WHERE auth_id IN (SELECT id FROM auth.users WHERE phone LIKE '%6005950197%')
   OR phone LIKE '%6005950197%';

-- 2. If not yet present, insert cleanly
INSERT INTO public.users (auth_id, phone, role, status, pin_hash)
SELECT 
  id AS auth_id,
  '6005950197',
  'super_admin'::user_role,
  'active'::account_status,
  '123456'
FROM auth.users
WHERE phone LIKE '%6005950197%'
  AND NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_id = auth.users.id OR phone LIKE '%6005950197%'
  );

-- 3. Ensure profile exists
INSERT INTO public.profiles (user_id, name, area, city)
SELECT 
  id AS user_id,
  'Super Admin' AS name,
  'Jammu' AS area,
  'Jammu' AS city
FROM public.users
WHERE phone LIKE '%6005950197%'
   OR auth_id IN (SELECT id FROM auth.users WHERE phone LIKE '%6005950197%')
ON CONFLICT (user_id) DO UPDATE 
SET name = 'Super Admin', area = 'Jammu', city = 'Jammu';

-- ─────────────────────────────────────────────────────────────
-- SECTION 6: SYSTEM SETTINGS & ANNOUNCEMENT BANNERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_settings: select" ON public.system_settings;
CREATE POLICY "system_settings: select" ON public.system_settings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "system_settings: manage" ON public.system_settings;
CREATE POLICY "system_settings: manage" ON public.system_settings FOR ALL USING (
  get_my_role() IN ('admin', 'super_admin')
  OR auth.uid() IS NOT NULL
);

INSERT INTO public.system_settings (key, value)
VALUES (
  'announcement',
  '{
    "enabled": false,
    "type": "maintenance",
    "title": "Service Notice",
    "message": "Our services will be briefly paused tonight from 11:00 PM to 3:00 AM for scheduled server maintenance.",
    "startTime": "23:00",
    "endTime": "03:00",
    "pauseBookings": false,
    "dismissible": true,
    "updatedAt": "2026-09-05T12:00:00Z"
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
