# Phase 1 Audit Report
**Date:** 2026-06-20  
**Phase:** Phase 1 — Supabase Setup and Database  
**Status:** ⚠️ BLOCKED — migration.sql must be run before Phase 1 is complete

---

## Files Created — ✅ All Present and Type-Safe

| File | Purpose | TypeScript |
|---|---|---|
| `lib/supabase/client.ts` | Browser client (anon key, RLS-respecting) | ✅ 0 errors |
| `lib/supabase/server.ts` | Server/API client (session cookies, RLS-respecting) | ✅ 0 errors |
| `lib/supabase/admin.ts` | Service role client (bypasses RLS, server-only) | ✅ 0 errors |
| `lib/utils/auth.ts` | `verifyAccountAccess()` + `requireSystemAdmin()` | ✅ 0 errors |
| `docs/migration.sql` | Full two-pass migration with verification queries | N/A |

`npx tsc --noEmit` passes with zero errors across all Phase 0 + Phase 1 files.

---

## TypeScript Fix Applied

`lib/supabase/server.ts` required an explicit `CookieOptions` type import from `@supabase/ssr` on the `setAll` cookie callback parameter. TypeScript strict mode (`noImplicitAny`) flagged the implicit `any` on the destructured `{ name, value, options }`. Fixed by importing `CookieOptions` and typing the parameter as `Array<{ name: string; value: string; options: CookieOptions }>`.

---

## Connectivity — ✅ Confirmed

Both clients reach the Supabase project (`bylvvwgnybydeoornsac`) successfully. See `docs/SUPABASE_CONNECTION_REPORT.md` for full details.

---

## Migration Status — ❌ Not Run

All 9 tables return HTTP 404 from the PostgREST API. The migration.sql has not yet been executed in the Supabase SQL Editor.

---

## Phase 1 Acceptance Criteria

| Criterion | Status | Blocker |
|---|---|---|
| All 9 tables exist in Supabase | ❌ | Run migration.sql |
| RLS enabled on all tables | ❌ | Run migration.sql |
| `handle_new_user` trigger auto-creates profile | ❌ | Run migration.sql |
| `idx_pages_unique_normalized_url` partial unique index exists | ❌ | Run migration.sql |
| First admin user elevated to `system_admin` | ❌ | Requires user + migration |
| Realtime enabled on pages, presence, activity_log, snapshots | ❌ | Run migration.sql |
| Supabase clients connect without errors | ✅ | — |
| TypeScript compiles with 0 errors | ✅ | — |

---

## Migration Instructions

### Step 1 — Run migration.sql

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → Project `bylvvwgnybydeoornsac`
2. SQL Editor → New Query
3. Paste entire contents of `docs/migration.sql`
4. Click **Run**

The file runs in three passes (A → B → C). All three must succeed.

> If any step fails with "already exists": the migration was partially run. Use the troubleshooting section below.

### Step 2 — Run the verification queries

Scroll to the bottom of `docs/migration.sql` — there are 6 verification `SELECT` queries. Run them and confirm:

```
1. 9 tables returned: accounts, activity_log, gsc_clicks, import_jobs, pages, presence, profiles, snapshots, user_accounts
2. rowsecurity = true for all 9 tables
3. 4 enums: import_conflict_behavior, import_job_status, import_mode, page_status
4. idx_pages_unique_normalized_url index exists on pages
5. trg_on_auth_user_created trigger exists
6. pages, presence, activity_log, snapshots are in supabase_realtime publication
```

### Step 3 — Seed the first system admin

After migration, create a user via Supabase Dashboard → Authentication → Users → Add user, then run:

```sql
-- Find the user ID
SELECT id, email FROM auth.users WHERE email = 'ido@whiteweb.co.il';

-- Elevate to system_admin
UPDATE profiles SET role = 'system_admin' WHERE id = '<paste-uuid-here>';

-- Verify
SELECT id, display_name, role FROM profiles WHERE role = 'system_admin';
```

### Step 4 — Enable Email/Password auth

Supabase Dashboard → Authentication → Providers → Email:
- ✅ Enable Email/Password
- ❌ Disable magic links (not used in v2)
- ❌ Disable all social providers (not used in v2)

---

## Troubleshooting: Partial Migration

If the migration was partially run (some tables already exist), run this in the SQL Editor to check current state:

```sql
-- What tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- What enums exist
SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname;

-- RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

Then re-run only the missing portions of `migration.sql`.

---

## What Will Be Verified After Migration

Once migration.sql is confirmed to have run, the following re-verification steps will be performed programmatically:

1. All 9 tables return HTTP 200 from the REST API via service role
2. Anon INSERT is blocked (RLS active) on all tables
3. Anon SELECT returns empty arrays (not errors) on all tables — confirming SELECT policies allow read but return 0 rows when not authenticated
4. Seed data: `accounts` table contains `Colman` row
5. `profiles` table exists (trigger will be verified on first signup)
6. Report final PASS/FAIL per acceptance criterion

---

## Security Notes

- `lib/supabase/admin.ts` uses `SUPABASE_SERVICE_ROLE_KEY` — server-side only. It throws at runtime if the env var is missing rather than silently failing.
- `lib/supabase/server.ts` uses session cookies — RLS applies automatically for all API routes that use this client.
- `lib/supabase/client.ts` uses the anon key — safe for browser bundles.
- None of the 4 files are imported in any client-side component yet (Phase 2+ only).
