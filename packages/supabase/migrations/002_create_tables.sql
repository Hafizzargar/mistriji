-- ============================================================
-- MistriJi — 002_create_tables.sql
-- Core table definitions
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- USERS
-- Primary identity table. Auth is handled by Supabase Auth.
-- We mirror only what we need here.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id       UUID UNIQUE,                       -- Supabase Auth user id
  phone         TEXT UNIQUE NOT NULL,
  role          user_role NOT NULL DEFAULT 'customer',
  status        account_status NOT NULL DEFAULT 'active',
  pin_hash      TEXT,                              -- bcrypt hash of 6-digit PIN
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- PROFILES
-- Common profile fields for all user types
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  user_id       UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  photo_url     TEXT,
  area          TEXT,
  district      TEXT,
  pincode       TEXT,
  city          TEXT NOT NULL DEFAULT 'Jammu',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- WORKER PROFILES
-- Extended fields for workers only
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.worker_profiles (
  user_id              UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  experience_years     INT NOT NULL DEFAULT 0 CHECK (experience_years >= 0 AND experience_years <= 50),
  is_available         BOOLEAN NOT NULL DEFAULT TRUE,
  verification_status  verification_status NOT NULL DEFAULT 'pending',
  phone_type           phone_type NOT NULL DEFAULT 'smartphone',
  enrollment_method    enrollment_method NOT NULL DEFAULT 'app',
  claimed              BOOLEAN NOT NULL DEFAULT TRUE, -- FALSE = employer created, not yet claimed by worker
  id_proof_url         TEXT,                          -- Aadhaar / document scan (optional)
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- EMPLOYER PROFILES
-- Extended fields for employers / contractors
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.employer_profiles (
  user_id        UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  business_name  TEXT,
  is_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- EMPLOYER ↔ WORKER (many-to-many)
-- A worker can work for multiple employers
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.employer_workers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  worker_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status        employer_worker_status NOT NULL DEFAULT 'active',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employer_id, worker_id)
);

-- ─────────────────────────────────────────────────────────────
-- SKILLS / SERVICE CATEGORIES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.skills (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT UNIQUE NOT NULL,
  name_hi     TEXT,                    -- Hindi name (Phase 2)
  icon        TEXT,                    -- emoji or icon name
  category    TEXT,                    -- e.g. 'electrical', 'plumbing', 'construction'
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- WORKER ↔ SKILLS (many-to-many)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.worker_skills (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  skill_id         UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  experience_years INT NOT NULL DEFAULT 0,
  UNIQUE(worker_id, skill_id)
);

-- ─────────────────────────────────────────────────────────────
-- JOBS
-- Core job/booking table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.jobs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  worker_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,   -- assigned after acceptance
  employer_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,   -- if worker is part of team
  skill_id          UUID NOT NULL REFERENCES public.skills(id) ON DELETE RESTRICT,
  status            job_status NOT NULL DEFAULT 'requested',
  address           TEXT NOT NULL,
  area              TEXT NOT NULL,
  lat               DECIMAL(9,6),
  lng               DECIMAL(9,6),
  preferred_time    TIMESTAMPTZ,
  description       TEXT,
  price             NUMERIC(10,2),                 -- agreed price (nullable until confirmed)
  payment_method    payment_method NOT NULL DEFAULT 'cash',
  payment_status    payment_status NOT NULL DEFAULT 'unpaid',
  worker_lat        DECIMAL(9,6),                  -- worker live location (updated by app)
  worker_lng        DECIMAL(9,6),
  cancelled_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cancel_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- RATINGS
-- Customer rates worker after job completion
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.ratings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id         UUID NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  from_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score          SMALLINT NOT NULL CHECK (score >= 1 AND score <= 5),
  comment        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- AUDIT LOGS
-- Track every sensitive admin/super-admin action
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,               -- e.g. 'verify_worker', 'delete_job', 'promote_admin'
  target_id    UUID,                        -- what was affected (worker id, job id, etc.)
  target_type  TEXT,                        -- 'worker', 'job', 'user', etc.
  old_value    JSONB,
  new_value    JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- INDEXES (performance)
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- AUTO-UPDATE updated_at TRIGGER
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_worker_profiles_updated_at
  BEFORE UPDATE ON public.worker_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
