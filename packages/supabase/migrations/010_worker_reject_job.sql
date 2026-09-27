
-- ============================================================
-- MistriJi — 010_worker_reject_job.sql
-- Adds RPC to reject a job and track metrics
-- ============================================================

CREATE OR REPLACE FUNCTION reject_job(p_job_id UUID, p_worker_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
DECLARE
  v_job record;
BEGIN
  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = p_job_id AND status = 'requested'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Only allow rejection if it was assigned directly to them, or it's a broadcast
  -- Actually, rejecting a broadcast just hides it for them. We will just increment their reject counter.
  
  UPDATE public.worker_profiles 
  SET jobs_rejected = COALESCE(jobs_rejected, 0) + 1 
  WHERE id = p_worker_id;

  -- If it was explicitly requested for them, mark job as rejected so customer knows
  IF v_job.requested_worker_id = p_worker_id THEN
    UPDATE public.jobs
    SET status = 'cancelled'
    WHERE id = p_job_id;
  END IF;

  RETURN true;
END;
\$\$;
