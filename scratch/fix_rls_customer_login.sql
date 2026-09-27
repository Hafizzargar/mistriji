-- Run this entire snippet in the Supabase Dashboard -> SQL Editor

-- 1. Allow EVERYONE to read users (so the auth modal can check if a phone exists)
-- This is safe because users only contains id, phone, email, role, and status. No passwords.
DROP POLICY IF EXISTS "users: select" ON public.users;
CREATE POLICY "users: select" ON public.users FOR SELECT USING (TRUE);
