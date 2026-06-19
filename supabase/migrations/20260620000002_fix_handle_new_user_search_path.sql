-- =============================================================================
-- Fix: handle_new_user() + RLS helper functions missing SET search_path
-- Date: 2026-06-20
--
-- Root cause: SECURITY DEFINER functions without SET search_path inherit the
-- caller's search_path at execution time. The auth trigger fires under
-- supabase_auth_admin whose search_path is "auth, pg_temp" — public is absent.
-- INSERT INTO profiles fails with "relation does not exist", causing
-- "Database error creating new user" in Supabase Auth.
--
-- Fix: Add SET search_path = public to all three SECURITY DEFINER functions
-- and fully qualify all table references with public. schema prefix.
-- CREATE OR REPLACE updates the function in-place; no trigger recreation needed.
-- =============================================================================

-- Fix handle_new_user (the function that fires on new user signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix is_system_admin (used in all RLS admin policies)
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'system_admin'
  )
$$;

-- Fix get_my_role (used in own_profile_update policy)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Verify all three functions now have search_path set
SELECT
  proname            AS function_name,
  prosecdef          AS is_security_definer,
  proconfig          AS config_options
FROM pg_proc
WHERE proname IN ('handle_new_user', 'is_system_admin', 'get_my_role')
  AND pronamespace = 'public'::regnamespace
ORDER BY proname;
-- Expected: proconfig = {search_path=public} for all three rows
