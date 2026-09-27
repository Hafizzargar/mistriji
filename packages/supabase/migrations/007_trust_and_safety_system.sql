-- ============================================================
-- MistriJi — 007_trust_and_safety_system.sql
-- Adds fields for anti-fraud, OTP verification, reward scoring,
-- and double-blind mutual reviews.
-- ============================================================

-- 1. JOBS TABLE ADDITIONS FOR VERIFICATION & FRAUD
ALTER TABLE public.jobs ADD COLUMN arrival_otp VARCHAR(6);
ALTER TABLE public.jobs ADD COLUMN completion_otp VARCHAR(6);
ALTER TABLE public.jobs ADD COLUMN worker_arrived_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN customer_confirmed_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN fraud_risk_score INTEGER DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN fraud_flags JSONB; -- e.g., ["Fast Job", "Same Customer"]
ALTER TABLE public.jobs ADD COLUMN reward_points_earned INTEGER DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN reward_status VARCHAR(20) DEFAULT 'pending'; -- pending, cleared, held, rejected

-- 2. LEADERBOARD CYCLES TABLE
CREATE TABLE public.leaderboard_cycles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' -- active, calculating_fraud, finalized
);

-- 3. UPGRADE RATINGS TO DOUBLE-BLIND "REVIEWS" SYSTEM
-- Drop the old UNIQUE constraint on job_id from ratings to allow mutual reviews
ALTER TABLE public.ratings DROP CONSTRAINT ratings_job_id_key;

-- Add fields for double-blind and private reporting
ALTER TABLE public.ratings ADD COLUMN role VARCHAR(10); -- 'customer' or 'worker'
ALTER TABLE public.ratings ADD COLUMN private_report_category VARCHAR(50);
ALTER TABLE public.ratings ADD COLUMN is_visible BOOLEAN DEFAULT false;
ALTER TABLE public.ratings ADD UNIQUE (job_id, from_user_id); -- One review per person per job

-- RLS policies for leaderboard_cycles
ALTER TABLE public.leaderboard_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaderboard cycles are viewable by everyone" ON public.leaderboard_cycles FOR SELECT USING (true);
CREATE POLICY "Super Admins can manage leaderboard cycles" ON public.leaderboard_cycles
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'));

-- Update Ratings RLS to handle visibility (only visible if is_visible is true or if you wrote it)
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
CREATE POLICY "View ratings" ON public.ratings FOR SELECT
  USING (is_visible = true OR from_user_id = auth.uid());

CREATE POLICY "Insert ratings" ON public.ratings FOR INSERT
  WITH CHECK (from_user_id = auth.uid());

-- Rpc function to check and publish reviews if both sides have reviewed
CREATE OR REPLACE FUNCTION public.check_and_publish_reviews(target_job_id UUID)
RETURNS void AS $$
DECLARE
  review_count INTEGER;
BEGIN
  -- Check how many reviews exist for this job
  SELECT COUNT(*) INTO review_count FROM public.ratings WHERE job_id = target_job_id;
  
  -- If both parties reviewed, make them visible
  IF review_count >= 2 THEN
    UPDATE public.ratings SET is_visible = true WHERE job_id = target_job_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPCS FOR SECURE JOB WORKFLOW AND FRAUD SCORE
CREATE OR REPLACE FUNCTION public.generate_arrival_otp(target_job_id UUID)
RETURNS VARCHAR(6) AS $$
DECLARE
  new_otp VARCHAR(6);
BEGIN
  -- Generate a random 6-digit OTP
  new_otp := lpad(floor(random() * 1000000)::text, 6, '0');
  UPDATE public.jobs SET arrival_otp = new_otp WHERE id = target_job_id AND status = 'accepted';
  RETURN new_otp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.verify_arrival_otp(target_job_id UUID, input_otp VARCHAR(6), worker_lat DECIMAL, worker_lng DECIMAL)
RETURNS BOOLEAN AS $$
DECLARE
  stored_otp VARCHAR(6);
BEGIN
  SELECT arrival_otp INTO stored_otp FROM public.jobs WHERE id = target_job_id AND status = 'accepted';
  IF stored_otp = input_otp THEN
    UPDATE public.jobs SET 
      status = 'arrived', 
      worker_arrived_at = NOW(),
      worker_lat = verify_arrival_otp.worker_lat,
      worker_lng = verify_arrival_otp.worker_lng
    WHERE id = target_job_id;
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.generate_completion_otp(target_job_id UUID)
RETURNS VARCHAR(6) AS $$
DECLARE
  new_otp VARCHAR(6);
BEGIN
  new_otp := lpad(floor(random() * 1000000)::text, 6, '0');
  UPDATE public.jobs SET completion_otp = new_otp WHERE id = target_job_id AND status = 'working';
  RETURN new_otp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.verify_completion_otp(target_job_id UUID, input_otp VARCHAR(6))
RETURNS BOOLEAN AS $$
DECLARE
  stored_otp VARCHAR(6);
BEGIN
  SELECT completion_otp INTO stored_otp FROM public.jobs WHERE id = target_job_id AND status = 'working';
  IF stored_otp = input_otp THEN
    UPDATE public.jobs SET status = 'completed', customer_confirmed_at = NOW() WHERE id = target_job_id;
    -- Note: calculating fraud score would typically be invoked asynchronously after completion.
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.calculate_fraud_score(target_job_id UUID)
RETURNS INTEGER AS $$
DECLARE
  job_record RECORD;
  score INTEGER := 0;
  flags JSONB := '[]'::jsonb;
  past_jobs INTEGER;
BEGIN
  SELECT * INTO job_record FROM public.jobs WHERE id = target_job_id;
  
  -- Rule 1: Very fast job duration (< 5 mins) for a job
  IF (EXTRACT(EPOCH FROM (job_record.customer_confirmed_at - job_record.worker_arrived_at)) < 300) THEN
    score := score + 40;
    flags := flags || '["Fast Job Duration (< 5 mins)"]'::jsonb;
  END IF;

  -- Rule 2: Repeated Customer & Worker combo > 3 times
  SELECT COUNT(*) INTO past_jobs FROM public.jobs 
  WHERE customer_id = job_record.customer_id AND worker_id = job_record.worker_id AND status = 'verified';
  
  IF past_jobs > 3 THEN
    score := score + 30;
    flags := flags || '["Repeated Customer/Worker Pairing"]'::jsonb;
  END IF;

  -- Update job with score and flags
  UPDATE public.jobs SET fraud_risk_score = score, fraud_flags = flags WHERE id = target_job_id;
  
  RETURN score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
