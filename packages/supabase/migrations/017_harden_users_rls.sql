-- ============================================================
-- Migration: 017_harden_users_rls.sql
-- Purpose: Restrict users table SELECT policy so clients cannot read other users' sensitive records or pin_hash.
-- ============================================================

DROP POLICY IF EXISTS "users: select" ON public.users;
DROP POLICY IF EXISTS "users: read own row" ON public.users;
DROP POLICY IF EXISTS "users: admin reads non-superadmin" ON public.users;

-- Users can only read their own user record; Admins and Superadmins can read all.
-- Login and account lookups are handled securely server-side via the backend API service role key.
CREATE POLICY "users: select secure" ON public.users
  FOR SELECT
  USING (
    id = get_my_user_id()
    OR auth_id = auth.uid()
    OR get_my_role() IN ('admin', 'super_admin')
  );
