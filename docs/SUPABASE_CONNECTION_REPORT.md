# Supabase Connection Report
**Date:** 2026-06-20  
**Project:** Colman Site Structure Manager v2  
**Audited by:** Claude Code — Phase 1 audit

---

## 1. Environment Variables

| Variable | Status |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Present |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Present |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Present |
| `CRON_SECRET` | ✅ Present |

All 4 required variables are set in `.env.local`.

---

## 2. Project Identity

| Field | Value |
|---|---|
| Project reference | `bylvvwgnybydeoornsac` |
| Project URL | `https://bylvvwgnybydeoornsac.supabase.co` |

---

## 3. Connectivity

| Test | Result |
|---|---|
| Anon client — auth endpoint | ✅ Reachable. `getSession()` returned successfully (no session, as expected for an unauthenticated call) |
| Anon client — REST API | ✅ Reachable. HTTP responses received from PostgREST |
| Service role client — REST API | ✅ Reachable. HTTP responses received from PostgREST |

**Conclusion:** The Supabase project is live and both clients (anon and service role) can reach it.

---

## 4. Authentication Status

- No user is currently signed in (expected — no auth has been implemented yet)
- Supabase Auth is reachable
- Email/password provider status: not verified from code (verify in Supabase Dashboard → Authentication → Providers)

---

## 5. Database Schema State

**Result: Migration has NOT been run.**

All 9 expected tables return HTTP 404 from the PostgREST REST API, confirming they do not exist in the `public` schema.

| Table | Status |
|---|---|
| `accounts` | ❌ Does not exist |
| `activity_log` | ❌ Does not exist |
| `gsc_clicks` | ❌ Does not exist |
| `import_jobs` | ❌ Does not exist |
| `pages` | ❌ Does not exist |
| `presence` | ❌ Does not exist |
| `profiles` | ❌ Does not exist |
| `snapshots` | ❌ Does not exist |
| `user_accounts` | ❌ Does not exist |

> **Note on probe methodology:** An earlier probe using `supabase-js` with `select('*', { count: 'exact', head: true })` incorrectly reported tables as "EXISTS". This was a false positive — the SDK's HEAD request returns a 200 with zero count even for non-existent tables in the version installed. The definitive test was raw `fetch()` calls to the PostgREST REST API, which returned 404 for all tables.

---

## 6. RLS Status

Not applicable — tables do not exist yet.

---

## 7. Realtime Status

Not applicable — tables must exist before Realtime can be configured.

---

## 8. Required Action

Run `docs/migration.sql` in the Supabase SQL Editor before Phase 1 can be considered complete.

**Steps:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → Project `bylvvwgnybydeoornsac`
2. Open **SQL Editor** → **New Query**
3. Paste the full contents of `docs/migration.sql`
4. Click **Run**
5. Scroll to the bottom — the verification queries at the end of the file will confirm success

---

## 9. What Cannot Be Tested Until Migration Runs

- Table existence and schema correctness
- RLS policy enforcement
- `handle_new_user` trigger (auto-creates profile on signup)
- `idx_pages_unique_normalized_url` partial unique index
- Seed data (Colman account)
- Realtime publication (`pages`, `presence`, `activity_log`, `snapshots`)
- Any Phase 2+ features
