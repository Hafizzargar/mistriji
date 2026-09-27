-- ============================================================
-- MistriJi — 001_create_enums.sql
-- All ENUM types used across tables
-- ============================================================

-- User roles
CREATE TYPE user_role AS ENUM (
  'customer',
  'worker',
  'employer',
  'admin',
  'super_admin'
);

-- Account status
CREATE TYPE account_status AS ENUM (
  'active',
  'pending',
  'suspended',
  'deleted'
);

-- Phone type (for keypad-phone workers)
CREATE TYPE phone_type AS ENUM (
  'smartphone',
  'keypad',
  'none'
);

-- How the worker was enrolled
CREATE TYPE enrollment_method AS ENUM (
  'field',        -- Admin met them in person
  'self_call',    -- Worker called / sent SMS
  'employer',     -- Employer added them
  'sms',          -- Future: automated SMS enrollment
  'app'           -- Worker self-registered via app
);

-- Worker verification status
CREATE TYPE verification_status AS ENUM (
  'pending',
  'verified',
  'rejected'
);

-- Employer-worker relationship status
CREATE TYPE employer_worker_status AS ENUM (
  'active',
  'inactive',
  'removed'
);

-- Job lifecycle status
CREATE TYPE job_status AS ENUM (
  'requested',
  'accepted',
  'on_way',
  'arrived',
  'working',
  'completed',
  'cancelled'
);

-- Payment method
CREATE TYPE payment_method AS ENUM (
  'cash',
  'upi',
  'pending'
);

-- Payment status
CREATE TYPE payment_status AS ENUM (
  'unpaid',
  'paid',
  'refunded'
);
