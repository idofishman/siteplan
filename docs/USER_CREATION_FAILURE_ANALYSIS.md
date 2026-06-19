# User Creation Failure Analysis
**Date:** 2026-06-20  
**Error:** "Database error creating new user" in Supabase Auth Dashboard  
**Scope:** Auth user creation only — no tables, RLS, or data are affected

---

## Root Cause

**`handle_new_user()` is a `SECURITY DEFINER` function with no `SET search_path`.**

When Supabase Auth creates a user it inserts a row into `auth.users`. This fires the `trg_on_auth_user_created` trigger, which calls `handle_new_user()`. Inside that function, the INSERT statement references `profiles` without a schema qualifier:

```sql
-- migration.sql line 79 — THE PROBLEM
INSERT INTO profiles (id, display_name) ...
```

Because the trigger fires on the `auth` schema and the function has no `SET search_path = public`, PostgreSQL searches for `profiles` in whatever schema is at the top of the active search path at trigger execution time. In Supabase's auth execution context the search path is `auth, pg_temp` — **`public` is not included**. PostgreSQL finds no table named `profiles` in those schemas and throws:

```
ERROR: relation "profiles" does not exist
```

This exception propagates back to GoTrue (Supabase's auth service), which surfaces it as the generic "Database error creating new user" message and rolls back the entire transaction — including the `auth.users` INSERT. The user is never created.

---

## Why It Works in the SQL Editor But Fails in Auth

When you run SQL in the Supabase SQL Editor, the session's default `search_path` is `"$user", public, extensions`. The unqualified `profiles` resolves to `public.profiles` correctly there.

When GoTrue calls `auth.users INSERT`, the database session is owned by the internal `supabase_auth_admin` role. That role's `search_path` is `auth, pg_temp`. The `public` schema is absent. The unqualified `profiles` reference fails to resolve.

---

## Secondary Issue: Same Pattern in `is_system_admin()` and `get_my_role()`

The two SECURITY DEFINER helper functions introduced in `rls_fix.sql` have the identical missing `search_path`:

```sql
CREATE OR REPLACE FUNCTION is_system_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE   -- no SET search_path
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles ...)  -- unqualified
$$;
```

These are called from RLS policies during HTTP requests via PostgREST. PostgREST sets the session `search_path` to `public, extensions` before evaluating policies, so they work correctly in that context. However they would fail in the same way as `handle_new_user()` if called from a different context (another trigger, a cron function, etc.).

They do not cause the current failure, but should be fixed for correctness and safety.

---

## Exact Fix

Run the following in **Supabase Dashboard → SQL Editor → New Query**:

```sql
-- Fix 1: handle_new_user — adds SET search_path and qualifies all table references
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

-- Fix 2: is_system_admin — same pattern fix
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

-- Fix 3: get_my_role — same pattern fix
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;
```

`CREATE OR REPLACE FUNCTION` replaces the function body and options in-place. The trigger (`trg_on_auth_user_created`) does not need to be dropped or recreated — it already points to `handle_new_user()` by name and will automatically use the new definition.

---

## Does migration.sql Need Updating?

**Yes.** The same defect is in `migration.sql` and `rls_fix.sql`. Both must be updated so future clean installs are correct. I will update both files after you confirm the live fix worked. The changes are mechanical: add `SET search_path = public` to each function declaration and prefix every table reference with `public.`.

---

## Diagnostic Query

Run this in **SQL Editor → New Query** to confirm the root cause before applying the fix:

```sql
-- 1. Confirm the trigger exists and points to handle_new_user
SELECT
  trigger_name,
  event_object_schema,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_on_auth_user_created';
-- Expected: 1 row, event_object_schema=auth, event_object_table=users

-- 2. Check whether handle_new_user has a search_path set
--    proconfig NULL = no search_path = the bug
--    proconfig '{search_path=public}' = fixed
SELECT
  proname,
  prosecdef   AS is_security_definer,
  proconfig   AS config_options
FROM pg_proc
WHERE proname IN ('handle_new_user', 'is_system_admin', 'get_my_role')
  AND pronamespace = 'public'::regnamespace;

-- 3. Simulate the trigger body in isolation (safe read-only — no actual insert)
--    If this fails with "relation profiles does not exist", the bug is confirmed.
DO $$
DECLARE
  v_display_name text;
BEGIN
  -- Simulate the COALESCE the trigger would compute
  v_display_name := COALESCE(NULL, split_part('test@example.com', '@', 1));
  -- Now try to reference the table as the trigger would
  PERFORM 1 FROM profiles LIMIT 0;
  RAISE NOTICE 'profiles is resolvable in current search_path — trigger will work here';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'profiles NOT resolvable — confirm search_path is: %', current_setting('search_path');
END;
$$;

-- 4. Show the current session search_path (should include public in SQL Editor)
SHOW search_path;
```

**What to look for:**
- Query 2: if `config_options` is `NULL` for `handle_new_user`, the bug is confirmed.
- Query 3: if you get `NOTICE: profiles NOT resolvable`, the search_path is the issue.
- Query 4: if `search_path` includes `public`, the SQL Editor session works fine but the auth session does not — this is consistent with the bug.

---

## Summary

| Item | Finding |
|---|---|
| Root cause | `handle_new_user()` lacks `SET search_path = public` |
| Trigger fails because | `INSERT INTO profiles` resolves against `auth` schema, not `public` |
| Error GoTrue shows | "Database error creating new user" |
| Tables/data affected | None — the `auth.users` insert is also rolled back |
| Fix required in Supabase | Yes — run the 3-function `CREATE OR REPLACE` block above |
| Fix required in migration.sql | Yes — update before any future clean install |
| Trigger needs recreation | No — `CREATE OR REPLACE FUNCTION` is sufficient |
| RLS or policies affected | No — this is purely a search_path issue in the function |
