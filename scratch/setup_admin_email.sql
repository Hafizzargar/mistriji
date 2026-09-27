-- Run this in Supabase Dashboard -> SQL Editor
-- This updates your Super Admin account to have an email address so you can use Email OTP.

UPDATE public.users
SET email = 'admin@mistriji.local'
WHERE phone = '6005950197';

-- Note: You can replace 'admin@mistriji.local' with your actual real email address!
