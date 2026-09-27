
-- ============================================================
-- MistriJi — 008_hybrid_booking_system.sql
-- Adds requested_worker_id and the claim_job RPC for Option 3
-- ============================================================

-- 1. Add requested_worker_id to track who the customer originally wanted
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS requested_worker_id UUID REFERENCES public.users(id);

-- 2. Backfill existing jobs: assume the assigned worker was the requested one
UPDATE public.jobs SET requested_worker_id = worker_id WHERE requested_worker_id IS NULL;

-- 3. Create the claim_job RPC for atomic job claiming
CREATE OR REPLACE FUNCTION claim_job(p_job_id UUID, p_worker_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to bypass RLS for this specific atomic action
AS \$\$
DECLARE
  v_job record;
BEGIN
  -- Select the job with an exclusive lock to prevent race conditions
  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = p_job_id AND status = 'requested'
  FOR UPDATE;

  -- If no job found, it's either cancelled, already accepted, or doesn't exist
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job is no longer available';
  END IF;

  -- Check the Hybrid Booking Rules:
  -- A worker can claim it IF:
  -- 1. They are the requested worker.
  -- 2. OR 5 minutes have passed since the job was created (Broadcast Mode).
  IF v_job.requested_worker_id = p_worker_id OR v_job.created_at < (NOW() - INTERVAL '5 minutes') THEN
    
    -- Update the job to assign it to this worker and change status to accepted
    UPDATE public.jobs
    SET worker_id = p_worker_id,
        status = 'accepted'
    WHERE id = p_job_id;

    RETURN true;
  ELSE
    RAISE EXCEPTION 'Job is currently exclusive to another worker. Please wait for the broadcast window.';
  END IF;
END;
\$\$;
