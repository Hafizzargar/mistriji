-- 1. Create the payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL UNIQUE, -- Razorpay order_id
  payment_id TEXT UNIQUE,        -- Razorpay payment_id (populated on capture)
  amount INTEGER NOT NULL,       -- Amount in smallest currency unit (e.g. paise)
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created', -- 'created', 'captured', 'failed'
  
  -- Relationships (FIXED: now referencing public.users and public.jobs)
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Customer who paid
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,   -- Reference to a specific job/booking
  worker_id UUID, -- Reference to the worker (if applicable)
  
  -- Metadata
  receipt_id TEXT,
  signature TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies (FIXED: using get_my_role() and get_my_user_id())
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
CREATE POLICY "Admins can view all payments" 
  ON public.payments 
  FOR SELECT 
  USING (
    get_my_role() IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
CREATE POLICY "Users can view their own payments" 
  ON public.payments 
  FOR SELECT 
  USING (get_my_user_id() = user_id);

-- 4. Setup auto-updating timestamp trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_payments_updated_at ON public.payments;
CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
