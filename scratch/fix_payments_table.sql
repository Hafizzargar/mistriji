-- 1. Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;

-- 2. Fix foreign key constraints
-- Remove wrong auth.users constraint
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;

-- Add correct public.users constraint
ALTER TABLE public.payments 
  ADD CONSTRAINT payments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Add correct public.jobs constraint (This fixes the 'jobs' relationship error)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS fk_job;
ALTER TABLE public.payments 
  ADD CONSTRAINT fk_job
  FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;

-- 3. Create Correct RLS Policies
CREATE POLICY "Admins can view all payments" 
  ON public.payments 
  FOR SELECT 
  USING (
    get_my_role() IN ('admin', 'super_admin')
  );

CREATE POLICY "Users can view their own payments" 
  ON public.payments 
  FOR SELECT 
  USING (get_my_user_id() = user_id);
