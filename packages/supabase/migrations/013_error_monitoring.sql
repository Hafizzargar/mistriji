-- ============================================================
-- Migration: Error Monitoring & Health System
-- Purpose: Creates tables for tracking backend and frontend errors
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_errors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint text NOT NULL,             -- Grouping hash (e.g. from error message + endpoint)
  severity text NOT NULL DEFAULT 'error',-- critical, high, warning, info
  endpoint text,                         -- Where the error happened (e.g., /api/bookings)
  error_message text NOT NULL,           -- The actual error message
  stack_trace text,                      -- The full stack trace for debugging
  user_id uuid,                          -- Affected user's ID (if known)
  user_role text,                        -- Affected user's role (if known)
  http_status integer,                   -- 500, 400, etc.
  browser_device text,                   -- User agent
  app_version text,
  status text NOT NULL DEFAULT 'open',   -- open, resolved, ignored
  occurrences integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  
  -- Security: Only admins and superadmins can view or manage errors
  CONSTRAINT system_errors_status_check CHECK (status IN ('open', 'resolved', 'ignored')),
  CONSTRAINT system_errors_severity_check CHECK (severity IN ('critical', 'high', 'warning', 'info', 'error'))
);

-- Indexing for fast lookups and grouping
CREATE INDEX IF NOT EXISTS system_errors_fingerprint_idx ON public.system_errors(fingerprint);
CREATE INDEX IF NOT EXISTS system_errors_status_idx ON public.system_errors(status);
CREATE INDEX IF NOT EXISTS system_errors_last_seen_idx ON public.system_errors(last_seen);

-- Enable RLS
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

-- Policy: Only admin and super_admin can read errors
CREATE POLICY "Admins can view errors" ON public.system_errors
  FOR SELECT
  USING (get_my_role() IN ('admin', 'super_admin'));

-- Policy: Only admin and super_admin can update errors (e.g. marking resolved)
CREATE POLICY "Admins can update errors" ON public.system_errors
  FOR UPDATE
  USING (get_my_role() IN ('admin', 'super_admin'));

-- Service Role (the backend Node.js app) bypasses RLS, so it can insert errors freely.
-- No INSERT policy needed for authenticated users, as errors are ingested via the backend API.
