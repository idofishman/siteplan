-- =============================================================================
-- RLS Recursion Fix — apply to existing database after initial migration
-- Date: 2026-06-20
-- Issue: 42P17 infinite recursion in all 9 tables' RLS policies
--
-- Root cause:
--   The "system_admin_all_profiles" policy on the `profiles` table used
--   EXISTS (SELECT 1 FROM profiles ...) — a policy on a table reading
--   from the same table. Postgres RLS evaluates this recursively forever.
--
--   Every other table has a "system_admin_all_X" policy that reads from
--   `profiles`. When RLS evaluates that read, it triggers `profiles` RLS
--   which then triggers the recursive loop.
--
-- Fix:
--   Two SECURITY DEFINER helper functions break the recursion by reading
--   `profiles` without RLS enforcement (they run as the defining role).
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Step 1: Helper functions (SECURITY DEFINER bypasses RLS on profiles)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_system_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'system_admin'
  )
$$;

-- Used in own_profile_update to prevent role self-escalation without recursion
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Fix profiles policies (the primary source of recursion)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "own_profile_update"         ON profiles;
DROP POLICY IF EXISTS "system_admin_all_profiles"  ON profiles;

-- Users can update their own display_name but cannot change their own role
CREATE POLICY "own_profile_update"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (is_system_admin() OR role = get_my_role())
  );

-- System admins can read and write all profiles
CREATE POLICY "system_admin_all_profiles"
  ON profiles FOR ALL
  USING (is_system_admin());


-- -----------------------------------------------------------------------------
-- Step 3: Fix accounts policy
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "system_admin_all_accounts" ON accounts;

CREATE POLICY "system_admin_all_accounts"
  ON accounts FOR ALL
  USING (is_system_admin());


-- -----------------------------------------------------------------------------
-- Step 4: Fix user_accounts policy
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "system_admin_all_user_accounts" ON user_accounts;

CREATE POLICY "system_admin_all_user_accounts"
  ON user_accounts FOR ALL
  USING (is_system_admin());


-- -----------------------------------------------------------------------------
-- Step 5: Fix pages policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "system_admin_all_pages" ON pages;

CREATE POLICY "system_admin_all_pages"
  ON pages FOR ALL
  USING (is_system_admin());


-- -----------------------------------------------------------------------------
-- Step 6: Fix activity_log policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "system_admin_all_activity" ON activity_log;

CREATE POLICY "system_admin_all_activity"
  ON activity_log FOR ALL
  USING (is_system_admin());


-- -----------------------------------------------------------------------------
-- Step 7: Fix snapshots policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "system_admin_all_snapshots" ON snapshots;

CREATE POLICY "system_admin_all_snapshots"
  ON snapshots FOR ALL
  USING (is_system_admin());


-- -----------------------------------------------------------------------------
-- Step 8: Fix gsc_clicks policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "system_admin_all_gsc" ON gsc_clicks;

CREATE POLICY "system_admin_all_gsc"
  ON gsc_clicks FOR ALL
  USING (is_system_admin());


-- -----------------------------------------------------------------------------
-- Step 9: Fix presence policy (admin branch used raw profiles subquery)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "user_account_presence_select" ON presence;

CREATE POLICY "user_account_presence_select"
  ON presence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.user_id = auth.uid()
      AND user_accounts.account_id = presence.account_id
    )
    OR is_system_admin()
  );


-- -----------------------------------------------------------------------------
-- Step 10: Fix import_jobs policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "system_admin_all_import_jobs" ON import_jobs;

CREATE POLICY "system_admin_all_import_jobs"
  ON import_jobs FOR ALL
  USING (is_system_admin());


-- -----------------------------------------------------------------------------
-- Verification: confirm no more recursion by selecting from each table as anon
-- (Run these in a separate query using the anon key via Dashboard → API)
-- Or confirm by re-running the verification probe.
-- -----------------------------------------------------------------------------

-- Check policies are in place
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check helper functions exist
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('is_system_admin', 'get_my_role')
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
