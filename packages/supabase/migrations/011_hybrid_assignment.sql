
-- ============================================================
-- MistriJi — 011_hybrid_assignment.sql
-- Adds support for Hybrid Booking Assignment (Admin Dispatch)
-- ============================================================

-- Add new job statuses
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'pending_dispatch';
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'admin_assigned';

-- RPC: Admin Assign Job
CREATE OR REPLACE FUNCTION admin_assign_job(p_job_id UUID, p_worker_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job record;
  v_admin_role text;
BEGIN
  -- Verify caller is admin
  SELECT role INTO v_admin_role FROM public.users WHERE id = auth.uid();
  IF v_admin_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Only allow assignment if job is not completed or cancelled
  IF v_job.status IN ('completed', 'cancelled') THEN
    RETURN false;
  END IF;

  UPDATE public.jobs
  SET status = 'admin_assigned',
      worker_id = p_worker_id,
      updated_at = NOW()
  WHERE id = p_job_id;

  RETURN true;
END;
$$;
