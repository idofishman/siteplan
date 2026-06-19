# Project Status — Colman Site Structure Manager v2
**Last updated:** 2026-06-20  
**Version:** 2.1.1  
**Status:** Phase 1 complete. Ready to begin Phase 2.

---

## 1. What This Project Is

A multi-account, Hebrew RTL sitemap management web app for managing the page structure of websites. Built for Colman (College of Management Academic Studies) and intended to support multiple client accounts under a single system admin.

Key product behaviors:
- Auto-save on every mutation — no manual save button
- Full account isolation enforced at the database level via RLS
- Drag-and-drop page tree with bulk operations
- Google Search Console data upload with URL normalization
- Snapshot system for full tree backups and restore
- Intelligent import engine (XLSX/CSV/JSON) with conflict resolution
- Realtime presence (who is online per account)
- Hebrew UI throughout (`lang="he" dir="rtl"`)

---

## 2. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 14.x |
| Language | TypeScript | 5 (strict mode) |
| Styling | Tailwind CSS | 3.x |
| Database | Supabase (Postgres + Auth + Realtime) | Latest |
| State | Zustand | 4.x |
| Drag and drop | @hello-pangea/dnd | 16.x |
| Excel import | xlsx | 0.18.x |
| Deployment target | Vercel | — |

No Redux. No React Query. No other state libraries.

---

## 3. Repository Structure (as of Phase 1)

```
/
├── app/
│   ├── layout.tsx            # Root layout — <html lang="he" dir="rtl">
│   ├── page.tsx              # Phase 0 placeholder (Phase 2 will make this redirect)
│   └── globals.css           # Tailwind directives
├── lib/
│   ├── constants.ts          # COLORS (16), TEMPLATES (22), STATUS_LABELS (Hebrew), STATUS_COLORS
│   ├── supabase/
│   │   ├── client.ts         # Browser client — anon key, RLS applies
│   │   ├── server.ts         # Server/API client — session cookies, RLS applies
│   │   └── admin.ts          # Service role client — bypasses RLS, server-only
│   └── utils/
│       ├── auth.ts           # verifyAccountAccess(), requireSystemAdmin()
│       ├── cn.ts             # clsx + tailwind-merge helper
│       └── url.ts            # normalizeUrl() — canonical URL comparison function
├── types/
│   └── index.ts              # All TypeScript interfaces (Account, Page, Profile, etc.)
├── supabase/
│   ├── config.toml           # Supabase CLI config (project_id = "Sitemaps")
│   └── migrations/
│       ├── 20260620000000_initial_schema.sql    # All 9 tables + RLS policies + seed
│       ├── 20260620000001_rls_recursion_fix.sql # Fixed 42P17 recursion in RLS policies
│       └── 20260620000002_fix_handle_new_user_search_path.sql  # Fixed auth trigger
├── docs/
│   ├── PRD.md                          # Product requirements
│   ├── Architecture.md                 # Tech stack, security model, directory spec
│   ├── Database.md                     # Full schema reference
│   ├── UI-Spec.md                      # Component and visual spec
│   ├── UserFlows.md                    # User journey diagrams
│   ├── Deployment.md                   # Deployment and environment guide
│   ├── Implementation-Plan.md          # Phase-by-phase build plan (Phases 0–14)
│   ├── migration.sql                   # Canonical migration (source of truth for future installs)
│   ├── rls_fix.sql                     # Patch applied to fix RLS recursion (already applied)
│   ├── SUPABASE_CONNECTION_REPORT.md   # Pre-migration connectivity audit
│   ├── PHASE1_AUDIT.md                 # Phase 1 audit (pre-migration state)
│   ├── POST_MIGRATION_REPORT.md        # Full post-migration verification results
│   ├── USER_CREATION_FAILURE_ANALYSIS.md  # Root cause analysis for auth trigger bug
│   └── PROJECT_STATUS.md               # This file
├── .env.example              # Template — 4 required env vars
├── .env.local                # Real secrets — gitignored, never committed
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

---

## 4. Environment Variables

All four are required. Set in `.env.local` (gitignored).

| Variable | Where to find it | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API | Browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API | Browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API | Server only — never expose to browser |
| `CRON_SECRET` | Any random string you generate | Presence cleanup cron endpoint |

Supabase project ref: `bylvvwgnybydeoornsac`  
Supabase URL: `https://bylvvwgnybydeoornsac.supabase.co`

---

## 5. Supabase Database State

### Tables (9/9) — all exist, all RLS enabled

| Table | Purpose |
|---|---|
| `accounts` | Client accounts (e.g. Colman). Seeded with 1 row. |
| `profiles` | One row per auth user. Auto-created by `handle_new_user()` trigger. |
| `user_accounts` | Many-to-many: which users can access which accounts. |
| `pages` | The sitemap tree. Core table. |
| `activity_log` | Append-only event log per account. |
| `snapshots` | Full tree backups stored as JSONB. Immutable after creation. |
| `gsc_clicks` | Google Search Console click data per account. |
| `presence` | Who is currently online per account. |
| `import_jobs` | Tracks file import analysis and apply operations. |

### Seed data

- `accounts`: one row — `Colman / colman / colman.ac.il / is_active=true`
- `profiles`: one row — `ido@whiteweb.co.il`, `role = system_admin`

### Key database objects

| Object | Details |
|---|---|
| `handle_new_user()` | SECURITY DEFINER trigger function. Fires AFTER INSERT on `auth.users`. Auto-creates a `profiles` row. **Must have `SET search_path = public`** — without it the auth trigger context can't resolve the table name. |
| `is_system_admin()` | SECURITY DEFINER helper. Used in all `system_admin_*` RLS policies. Bypasses RLS on `profiles` to avoid 42P17 infinite recursion. |
| `get_my_role()` | SECURITY DEFINER helper. Used in `own_profile_update` policy to prevent role self-escalation without recursion. |
| `trg_on_auth_user_created` | AFTER INSERT trigger on `auth.users` calling `handle_new_user()`. |
| `idx_pages_unique_normalized_url` | Partial unique index on `pages(account_id, url_normalized) WHERE url_normalized IS NOT NULL`. Enforces URL uniqueness per account. |
| `supabase_realtime` publication | Includes `pages`, `presence`, `activity_log`, `snapshots`. |

### Enums

| Enum | Values |
|---|---|
| `page_status` | `planned`, `existing`, `in_progress`, `needs_review`, `approved`, `deprecated`, `redirect`, `archived` |
| `import_mode` | `analyze_only`, `merge_into_existing`, `create_new_sitemap` |
| `import_conflict_behavior` | `add_only`, `overwrite_existing` |
| `import_job_status` | `analyzing`, `ready_for_review`, `applied`, `failed`, `cancelled` |

### RLS security model

- **RLS is the primary security boundary.** API-level checks are defense-in-depth only.
- All `system_admin_*` policies use `is_system_admin()` (SECURITY DEFINER) to avoid table self-reference recursion.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — must only be used server-side for admin operations, Auth admin API, and cron jobs. Never sent to the browser.
- For all normal authenticated operations, use the user's session client (`lib/supabase/server.ts`) so RLS applies automatically.

---

## 6. Migrations Workflow

The Supabase CLI is installed (npx, v2.107.0) and linked to the project.

```bash
# Check migration status
npx supabase migration list

# Apply new migrations
npx supabase migration new <description>   # creates new file in supabase/migrations/
npx supabase db push                       # applies pending migrations to remote

# Run a one-off query
npx supabase db query --linked "SELECT ..."
npx supabase db query --linked --file path/to/file.sql
```

All 3 migrations are in sync (local = remote):

| Migration | Description | Status |
|---|---|---|
| `20260620000000` | Initial schema — all 9 tables, RLS, enums, seed, Realtime | Applied |
| `20260620000001` | RLS recursion fix — `is_system_admin()`, `get_my_role()`, rebuilt 10 policies | Applied |
| `20260620000002` | `SET search_path = public` on all 3 SECURITY DEFINER functions | Applied |

`docs/migration.sql` is the consolidated canonical migration. It is kept up to date with all fixes and is the correct source for future clean installs.

---

## 7. Git Commits

| Hash | Message | What it contains |
|---|---|---|
| `10e5adb` | Phase 0 project setup | Next.js scaffold, all config, types, constants, `normalizeUrl`, placeholder page |
| `50e1737` | Phase 1 Supabase setup — client files and migration SQL | 4 Supabase client files, `auth.ts` helpers, initial `migration.sql` |
| `b0a0997` | Phase 1 audited and verified | `SUPABASE_CONNECTION_REPORT.md`, `PHASE1_AUDIT.md` |
| `7bc0ade` | Phase 1 migration verified | `POST_MIGRATION_REPORT.md`, `rls_fix.sql`, updated `migration.sql` with RLS fix |
| `41398e3` | Phase 1 finalization — CLI setup, search_path fix, full verification | Supabase CLI init, migrations folder, migration `00002`, updated docs, `USER_CREATION_FAILURE_ANALYSIS.md` |

Working tree is clean. Branch: `master`.

---

## 8. Known Issues and Decisions

### Issues fixed during Phase 1

| Issue | Root cause | Fix applied |
|---|---|---|
| `42P17` infinite recursion on every anon request | `system_admin_all_profiles` policy queried `profiles` from within a `profiles` policy | `is_system_admin()` SECURITY DEFINER function; all 10 affected policies rebuilt |
| "Database error creating new user" in Supabase Auth | `handle_new_user()` had no `SET search_path`; auth trigger runs under `supabase_auth_admin` role whose search path excludes `public` | Added `SET search_path = public` + `public.profiles` schema qualifier to all 3 SECURITY DEFINER functions |

### Deliberate design decisions (do not change without reason)

| Decision | Rationale |
|---|---|
| `@supabase/ssr@^0.5` (not `^0.1` from original docs) | `^0.1` is outdated; user explicitly chose latest stable |
| `xlsx@^0.18` despite known CVEs | User decision; flagged as TODO for future upgrade |
| `next@14` despite CVEs | Upgrading to next@16 is a breaking change; deferred |
| Last Write Wins concurrency | Intentional product decision; no optimistic locking |
| No global Save button | Auto-save on every mutation is a core product requirement |
| `normalizeUrl()` used everywhere URLs are compared | Single source of truth for URL comparison across CRUD, GSC, import, and missing URLs features |

---

## 9. Phases Overview

| Phase | Description | Status |
|---|---|---|
| 0 | Project setup (Next.js, TypeScript, Tailwind, base utils) | ✅ Complete |
| 1 | Supabase database (9 tables, RLS, enums, Realtime, seed) | ✅ Complete |
| 2 | Authentication (login page, middleware, route protection) | 🔜 Next |
| 3 | Account selection and switching | Pending |
| 4 | Core tree — load and display | Pending |
| 5 | Page CRUD with auto-save | Pending |
| 6 | Page status, notes, and drag-and-drop move | Pending |
| 7 | Bulk operations (6 actions, multi-select) | Pending |
| 8 | Presence system (who is online per account) | Pending |
| 9 | Activity feed with filters | Pending |
| 10 | Snapshots (create, restore, compare, export) | Pending |
| 11 | GSC import engine + missing URLs tab | Pending — requires Phases 0–10 |
| 12 | Intelligent sitemap import (XLSX/CSV/JSON) | Pending — requires Phases 0–11 |
| 13 | Admin panel + Danger Zone (clear sitemap, user management) | Pending — requires Phases 0–12 |
| 14 | Polish, edge cases, final end-to-end verification | Pending — last phase |

---

## 10. Recommended Next Step — Phase 2: Authentication

**Goal:** Login/logout with route protection via Next.js middleware.

**Files to create:**
- `app/login/page.tsx` — Hebrew login form
- `app/login/actions.ts` — `signInWithPassword` server action
- `components/auth/AuthProvider.tsx` — auth state listener
- `middleware.ts` — protects `/app/*` and `/admin/*`, redirects unauthenticated users to `/login`
- Update `app/page.tsx` — root redirect based on session + account state

**Acceptance criteria (from `docs/Implementation-Plan.md`):**
- Visiting `/app` while logged out → redirects to `/login`
- Wrong credentials → "אימייל או סיסמה שגויים" (Hebrew error)
- Correct credentials → redirects away from `/login`
- Session persists across browser refresh
- Non-admin visiting `/admin` → redirects to `/app`

**Reference documents:**
- `docs/Implementation-Plan.md` § Phase 2 — full file list and acceptance criteria
- `docs/Architecture.md` § 2 — security model (session client vs service role client)
- `docs/UserFlows.md` — login flow diagrams
- `docs/UI-Spec.md` — login page visual spec

**To start:** Confirm approval, then implement Phase 2 only. Do not implement Phase 3 or beyond until all Phase 2 acceptance criteria pass.

---

## 11. Local Development

```bash
# Install dependencies (already done)
npm install

# Start dev server
npm run dev
# → http://localhost:3000

# Type check
npm run typecheck

# Apply new database migrations
npx supabase db push
```

Node.js v24.17.0, npm 11.13.0 confirmed installed.  
`.env.local` must be present with all 4 env vars before running the dev server.
