
-- ============================================================
-- MistriJi — 009_platform_features.sql
-- Adds Global Platform Features & Worker Metrics
-- ============================================================

-- 1. Insert default platform features into system_settings
INSERT INTO public.system_settings (key, value)
VALUES (
  'platform_features',
  '{
    "show_preferred_time": true,
    "show_worker_phones": false,
    "allow_direct_calls": false
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 2. Add Worker Metrics for Job Acceptance & Rejection tracking
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS jobs_accepted INT DEFAULT 0;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS jobs_rejected INT DEFAULT 0;

-- 3. Modify the claim_job RPC to increment jobs_accepted
CREATE OR REPLACE FUNCTION claim_job(p_job_id UUID, p_worker_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
DECLARE
  v_job record;
BEGIN
  -- Select the job with an exclusive lock to prevent race conditions
  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = p_job_id AND status = 'requested'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job is no longer available';
  END IF;

  IF v_job.requested_worker_id = p_worker_id OR v_job.created_at < (NOW() - INTERVAL '5 minutes') THEN
    
    -- Assign job
    UPDATE public.jobs
    SET worker_id = p_worker_id,
        status = 'accepted'
    WHERE id = p_job_id;

    -- Increment accepted metric
    UPDATE public.worker_profiles 
    SET jobs_accepted = COALESCE(jobs_accepted, 0) + 1 
    WHERE id = p_worker_id;

    RETURN true;
  ELSE
    RAISE EXCEPTION 'Job is currently exclusive to another worker. Please wait for the broadcast window.';
  END IF;
END;
\$\$;
