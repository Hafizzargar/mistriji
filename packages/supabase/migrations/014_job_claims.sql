-- ============================================================
-- MistriJi — 014_job_claims.sql
-- Job Claims system for workers
-- ============================================================

CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS public.job_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status claim_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(job_id, worker_id)
);

-- Enable RLS
ALTER TABLE public.job_claims ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Workers can view their own claims"
  ON public.job_claims FOR SELECT
  USING (auth.uid() = worker_id);

CREATE POLICY "Workers can insert their own claims"
  ON public.job_claims FOR INSERT
  WITH CHECK (auth.uid() = worker_id);

CREATE POLICY "Admins can view all claims"
  ON public.job_claims FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY "Admins can update all claims"
  ON public.job_claims FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_claims;
