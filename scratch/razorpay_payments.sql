-- Razorpay Payments Table Migration
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL UNIQUE, -- Razorpay order_id
  payment_id TEXT UNIQUE,        -- Razorpay payment_id (populated on capture)
  amount INTEGER NOT NULL,       -- Amount in smallest currency unit (e.g. paise)
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created', -- 'created', 'captured', 'failed'
  
  -- Relationships
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Customer who paid
  job_id UUID,   -- Reference to a specific job/booking (if applicable)
  worker_id UUID, -- Reference to the worker (if applicable)
  
  -- Metadata
  receipt_id TEXT,
  signature TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies for the Payments Table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Admins can see all payments
CREATE POLICY "Admins can view all payments" 
  ON public.payments 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.role = 'admin' OR profiles.role = 'superadmin')
    )
  );

-- Customers can view their own payments
CREATE POLICY "Users can view their own payments" 
  ON public.payments 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Only the server (service role) can insert or update payments!
-- This enforces the security rule: Frontend cannot create or fake payments directly in DB.
-- No INSERT/UPDATE policies for standard users.

-- Set up a trigger to auto-update the updated_at timestamp
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

-- Add 'razorpay_enabled' to the global settings if you have a DB settings table,
-- but based on your codebase, settings are stored via JSON in a generic key-value way,
-- so the React UI update handles that automatically.
