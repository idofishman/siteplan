# Deployment.md — Colman Site Structure Manager v2
**Version:** 2.1.1  
**Status:** Final  
**Date:** 2026-06-19  
**Audience:** Claude Code (implementation reference)

---

## Overview

This document covers the complete deployment pipeline for v2.1.1:

1. Local development environment setup
2. Supabase project setup
3. Full database migration (all tables first, then all RLS policies)
4. Auth configuration
5. First system admin setup
6. Realtime configuration
7. URL normalization specification
8. Vercel deployment
9. Environment variables
10. Presence cleanup cron
11. Behavioral policies (account deactivation, concurrent editing, snapshot retention, import limits)
12. Post-deployment verification tests
13. Common errors and fixes
14. Migration verification checklist

The app is a multi-account platform. Each account has its own isolated sitemap, GSC data, activity log, snapshots, and users. Account isolation is enforced at the database level via Row Level Security (RLS). There is no shared sitemap and no global page tree.

---

## Part 1: Local Development Setup

### 1.1 Requirements

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18.x or 20.x | LTS required |
| npm | 9.x+ | Comes with Node |
| Git | Any recent | For GitHub push |
| Supabase account | — | Free tier sufficient for dev |
| Vercel account | — | Free tier sufficient |

### 1.2 Clone and Install

```bash
git clone https://github.com/your-org/colman-sitemap-v2.git
cd colman-sitemap-v2
npm install
```

### 1.3 Create .env.local

```bash
cp .env.example .env.local
```

Fill in all values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
CRON_SECRET=generate-with-openssl-rand-hex-32
```

Where to find each value: Supabase Dashboard → Settings → API.

**Security rules for environment variables:**
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are safe to expose to the browser
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — it must never be committed to git, never sent to the client, and never included in any browser bundle
- `CRON_SECRET` protects the cleanup endpoint — keep it secret

Generate CRON_SECRET:
```bash
openssl rand -hex 32
```

### 1.4 Start Local Dev Server

```bash
npm run dev
```

App available at http://localhost:3000.

### 1.5 Verify TypeScript Compiles

```bash
npx tsc --noEmit
```

Must output zero errors before any deployment.

---

## Part 2: Supabase Project Setup

### 2.1 Create Project

1. Go to https://supabase.com → New Project
2. Set a strong database password (save it)
3. Choose a region close to your users
4. Wait for provisioning (~2 minutes)

### 2.2 Open SQL Editor

Dashboard → SQL Editor → New Query

All migration SQL in Part 3 must be run here, in the exact order listed.

---

## Part 3: Database Migration

### IMPORTANT: Migration Strategy

**Run all CREATE TABLE statements first. Apply all RLS policies after all tables exist.**

This is required because some policies reference multiple tables. For example, the `accounts` RLS policy references both `profiles` and `user_accounts`. If policies are applied immediately after each table is created, the SQL will fail with "relation does not exist."

Migration runs in two passes:
- **Pass A:** Create all tables and triggers (no RLS yet)
- **Pass B:** Enable RLS and create all policies (all tables exist at this point)

---

### Pass A — Create All Tables

Run each block below in order. Do not enable RLS or create policies yet.

#### A-1: Shared Trigger Function

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### A-2: accounts table

```sql
CREATE TABLE accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  domain      text,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_slug ON accounts(slug);
CREATE INDEX idx_accounts_is_active ON accounts(is_active);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### A-3: profiles table + auto-create trigger

```sql
CREATE TABLE profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  role         text NOT NULL DEFAULT 'user' CHECK (role IN ('system_admin', 'user')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

#### A-4: user_accounts table

```sql
CREATE TABLE user_accounts (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, account_id)
);

CREATE INDEX idx_user_accounts_user_id ON user_accounts(user_id);
CREATE INDEX idx_user_accounts_account_id ON user_accounts(account_id);
```

#### A-5: pages table

```sql
CREATE TYPE page_status AS ENUM (
  'planned',
  'existing',
  'in_progress',
  'needs_review',
  'approved',
  'deprecated',
  'redirect',
  'archived'
);

CREATE TABLE pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  parent_id       uuid REFERENCES pages(id) ON DELETE CASCADE,
  name            text NOT NULL,
  url             text,
  url_normalized  text,
  color           text,
  template        text CHECK (template IN (
                    'page','hub','homepage','faculty','department','degree',
                    'blog','blog-post','course','staff','staff-directory',
                    'research','research-center','research-network',
                    'registration','campus','student-life','portal',
                    'event','form','archive','gallery'
                  )),
  status          page_status NOT NULL DEFAULT 'existing',
  notes           text,
  sort_order      integer NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pages_account_id ON pages(account_id);
CREATE INDEX idx_pages_parent_id ON pages(parent_id);
CREATE INDEX idx_pages_account_parent ON pages(account_id, parent_id);
CREATE INDEX idx_pages_account_sort ON pages(account_id, sort_order);
CREATE INDEX idx_pages_status ON pages(account_id, status);
CREATE INDEX idx_pages_url ON pages(account_id, url);
CREATE INDEX idx_pages_url_normalized ON pages(account_id, url_normalized);

-- Enforce URL uniqueness within an account (only when url_normalized is not null)
CREATE UNIQUE INDEX idx_pages_unique_normalized_url
  ON pages(account_id, url_normalized)
  WHERE url_normalized IS NOT NULL;

CREATE TRIGGER trg_pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### A-6: activity_log table

```sql
CREATE TABLE activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   text NOT NULL DEFAULT '',
  action      text NOT NULL,
  entity_type text,
  entity_id   uuid,
  entity_name text,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_account_id ON activity_log(account_id);
CREATE INDEX idx_activity_log_account_created ON activity_log(account_id, created_at DESC);
CREATE INDEX idx_activity_log_user_id ON activity_log(account_id, user_id);
CREATE INDEX idx_activity_log_action ON activity_log(account_id, action);
```

#### A-7: snapshots table

```sql
CREATE TABLE snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name             text NOT NULL,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name  text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  page_count       integer NOT NULL DEFAULT 0,
  data             jsonb NOT NULL
);

CREATE INDEX idx_snapshots_account_id ON snapshots(account_id);
CREATE INDEX idx_snapshots_account_created ON snapshots(account_id, created_at DESC);
```

Note: No UPDATE trigger on snapshots — they are immutable after creation. No `updated_at` column.

#### A-8: gsc_clicks table

```sql
CREATE TABLE gsc_clicks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  url_original    text NOT NULL,
  url_normalized  text NOT NULL,
  clicks          integer NOT NULL DEFAULT 0,
  impressions     integer,
  ctr             numeric(5,4),
  position        numeric(6,2),
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  uploaded_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (account_id, url_normalized)
);

CREATE INDEX idx_gsc_clicks_account_id ON gsc_clicks(account_id);
CREATE INDEX idx_gsc_clicks_account_url ON gsc_clicks(account_id, url_normalized);
CREATE INDEX idx_gsc_clicks_account_clicks ON gsc_clicks(account_id, clicks DESC);
```

#### A-9: presence table

```sql
CREATE TABLE presence (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  last_seen    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, account_id)
);

CREATE INDEX idx_presence_account_id ON presence(account_id);
CREATE INDEX idx_presence_last_seen ON presence(account_id, last_seen);
```

#### A-10: import_jobs table

```sql
CREATE TYPE import_job_status AS ENUM (
  'analyzing',
  'ready_for_review',
  'applied',
  'failed',
  'cancelled'
);

CREATE TYPE import_mode AS ENUM (
  'analyze_only',
  'merge_into_existing',
  'create_new_sitemap'
);

CREATE TYPE import_conflict_behavior AS ENUM (
  'add_only',
  'overwrite_existing'
);

CREATE TABLE import_jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name           text NOT NULL,
  file_type           text NOT NULL CHECK (file_type IN ('xlsx', 'csv', 'json')),
  prompt              text,
  mode                import_mode NOT NULL,
  conflict_behavior   import_conflict_behavior,
  status              import_job_status NOT NULL DEFAULT 'analyzing',
  summary             jsonb,
  warnings            jsonb,
  proposed_pages      jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  applied_at          timestamptz
);

CREATE INDEX idx_import_jobs_account_id ON import_jobs(account_id);
CREATE INDEX idx_import_jobs_account_created ON import_jobs(account_id, created_at DESC);
CREATE INDEX idx_import_jobs_status ON import_jobs(account_id, status);
```

---

### Pass B — Enable RLS and Create All Policies

All 9 tables exist now. Run all policy blocks below.

#### B-1: accounts RLS

```sql
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- System admins can read and write all accounts
CREATE POLICY "system_admin_all_accounts"
  ON accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

-- Regular users can only see active accounts they are assigned to
CREATE POLICY "user_assigned_accounts"
  ON accounts FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM user_accounts ua
      WHERE ua.account_id = accounts.id
      AND ua.user_id = auth.uid()
    )
  );
```

#### B-2: profiles RLS

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "own_profile_select"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile but cannot change their own role
CREATE POLICY "own_profile_update"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- System admins can read and write all profiles
CREATE POLICY "system_admin_all_profiles"
  ON profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
    )
  );

-- Users in the same account can read each other's display_name
-- (needed for activity feed and presence display)
CREATE POLICY "account_member_profiles_select"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM user_accounts ua1
      JOIN user_accounts ua2 ON ua1.account_id = ua2.account_id
      WHERE ua1.user_id = auth.uid()
      AND ua2.user_id = profiles.id
    )
  );
```

#### B-3: user_accounts RLS

```sql
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;

-- System admins can manage all assignments
CREATE POLICY "system_admin_all_user_accounts"
  ON user_accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

-- Users can read their own assignments (to know which accounts they belong to)
CREATE POLICY "user_own_assignments_select"
  ON user_accounts FOR SELECT
  USING (user_id = auth.uid());
```

#### B-4: pages RLS

```sql
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- RLS is the source of truth for account isolation.
-- API-level access checks are defense-in-depth, not a replacement for RLS.

CREATE POLICY "system_admin_all_pages"
  ON pages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "user_account_pages_select"
  ON pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.user_id = auth.uid()
      AND user_accounts.account_id = pages.account_id
    )
  );

CREATE POLICY "user_account_pages_insert"
  ON pages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.user_id = auth.uid()
      AND user_accounts.account_id = pages.account_id
    )
  );

CREATE POLICY "user_account_pages_update"
  ON pages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.user_id = auth.uid()
      AND user_accounts.account_id = pages.account_id
    )
  );

CREATE POLICY "user_account_pages_delete"
  ON pages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.user_id = auth.uid()
      AND user_accounts.account_id = pages.account_id
    )
  );
```

#### B-5: activity_log RLS

```sql
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_admin_all_activity"
  ON activity_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "user_account_activity_select"
  ON activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.user_id = auth.uid()
      AND user_accounts.account_id = activity_log.account_id
    )
  );
```

#### B-6: snapshots RLS

```sql
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_admin_all_snapshots"
  ON snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "user_account_snapshots_select"
  ON snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.user_id = auth.uid()
      AND user_accounts.account_id = snapshots.account_id
    )
  );

CREATE POLICY "user_account_snapshots_insert"
  ON snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.user_id = auth.uid()
      AND user_accounts.account_id = snapshots.account_id
    )
  );

CREATE POLICY "user_account_snapshots_delete"
  ON snapshots FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.user_id = auth.uid()
      AND user_accounts.account_id = snapshots.account_id
    )
  );

-- NO UPDATE policy: snapshots are immutable after creation
```

#### B-7: gsc_clicks RLS

```sql
ALTER TABLE gsc_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_admin_all_gsc"
  ON gsc_clicks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "user_account_gsc_select"
  ON gsc_clicks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.user_id = auth.uid()
      AND user_accounts.account_id = gsc_clicks.account_id
    )
  );
```

#### B-8: presence RLS

```sql
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_account_presence_select"
  ON presence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.user_id = auth.uid()
      AND user_accounts.account_id = presence.account_id
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "user_own_presence_insert"
  ON presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_own_presence_update"
  ON presence FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "user_own_presence_delete"
  ON presence FOR DELETE
  USING (user_id = auth.uid());
```

#### B-9: import_jobs RLS

```sql
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_admin_all_import_jobs"
  ON import_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "user_account_import_jobs_all"
  ON import_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.user_id = auth.uid()
      AND user_accounts.account_id = import_jobs.account_id
    )
  );
```

---

### Pass C — Seed Initial Data

After all tables and policies exist:

```sql
-- Insert your first account(s)
INSERT INTO accounts (name, slug, domain) VALUES
  ('Colman', 'colman', 'colman.ac.il');

-- Add more accounts as needed:
-- INSERT INTO accounts (name, slug, domain) VALUES ('White Web Worx', 'white-web-worx', 'whiteweb.co.il');
```

---

## Part 4: Auth Configuration

### 4.1 Enable Email/Password

Supabase Dashboard → Authentication → Providers → Email:
- Enable Email/Password ✅
- Email confirmations: optional for dev, recommended for production
- Disable all social providers (not used in v2)
- Disable magic links (not used in v2)

### 4.2 Allowed Redirect URLs

Authentication → URL Configuration:
- Site URL: `https://your-app.vercel.app` (update after Vercel deploy)
- Additional redirect URLs: `http://localhost:3000` (for local dev)

---

## Part 5: First System Admin

### 5.1 Create a User

Sign up via the app at /login, or create a user manually in:  
Supabase Dashboard → Authentication → Users → Add user

### 5.2 Find the User ID

```sql
SELECT id, email FROM auth.users WHERE email = 'your-admin@example.com';
```

Copy the `id` value.

### 5.3 Elevate to system_admin

```sql
UPDATE profiles
SET role = 'system_admin'
WHERE id = 'paste-uuid-here';
```

### 5.4 Verify

```sql
SELECT id, display_name, role FROM profiles WHERE role = 'system_admin';
-- Expected: 1 row
```

### 5.5 Test Admin Access

1. Log in at /login with the admin credentials
2. Confirm redirect to /select-account showing all accounts
3. Confirm /admin link visible in header
4. Confirm /admin loads the account management panel

---

## Part 6: Realtime Configuration

**Realtime must be enabled immediately after database migration is complete and before application testing begins.** Collaboration features (live tree updates, presence) will silently fail until this step is done. Do not skip ahead to testing without completing it.

### 6.1 Enable Realtime on Required Tables

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE pages;
ALTER PUBLICATION supabase_realtime ADD TABLE presence;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE snapshots;
```

### 6.2 Verify

Supabase Dashboard → Database → Replication → supabase_realtime  
Confirm all four tables appear in the publication list.

### 6.3 How Realtime is Used

The client subscribes to one channel per active account:

```
channel: `account-${accountId}`
filter:  account_id=eq.${accountId}

Subscribed tables:
  pages           → INSERT/UPDATE/DELETE → updates tree for all users in account
  presence        → any change → refreshes who is online
  activity_log    → INSERT → live-updates activity feed
  snapshots       → INSERT/DELETE → updates snapshot list
```

Users only receive events for their active account. Switching accounts unsubscribes from the old channel and subscribes to the new one.

---

## Part 7: URL Normalization Specification

URL normalization is a core requirement. It is used in four separate subsystems:
- **Sitemap CRUD:** `url_normalized` is computed and stored whenever a page URL is set or changed
- **GSC Import:** all uploaded URLs are normalized before insert into `gsc_clicks`
- **Intelligent Import Engine:** imported URLs are normalized and matched against existing pages
- **Missing URLs Engine:** GSC urls are matched against sitemap page urls using normalized form

**All four subsystems must use the same shared function.** Do not implement URL comparison in ad-hoc ways.

### 7.1 Normalization Rules

| Rule | Example Input | Example Output |
|---|---|---|
| Lowercase path | `/About/Us` | `/about/us` |
| Remove trailing slash | `/admissions/` | `/admissions` |
| Root slash preserved | `/` | `/` |
| Remove query string | `/page?ref=gsc` | `/page` |
| Remove hash | `/page#section` | `/page` |
| Convert absolute URL to relative (domain matches account) | `https://colman.ac.il/about` | `/about` |
| Convert absolute URL to relative (www variant) | `https://www.colman.ac.il/about` | `/about` |
| Treat `/about` and `/about/` as identical | both → `/about` | `/about` |
| Strip http and https variants when domain matches | `http://colman.ac.il/about` | `/about` |
| Return null for unparseable strings | `not a url!!!` | `null` |

### 7.2 Implementation Location

```
lib/utils/url.ts
```

Function signature:
```typescript
export function normalizeUrl(
  rawUrl: string | null | undefined,
  accountDomain?: string   // e.g., 'colman.ac.il'
): string | null
```

This function must be importable on both client and server. It has no external dependencies.

### 7.3 When to Call

- Page CREATE or UPDATE where `url` field is provided → compute `url_normalized` before INSERT/UPDATE
- GSC CSV upload → normalize each `url_original` before INSERT into `gsc_clicks`
- Import analysis → normalize each imported URL before matching against existing pages
- Missing URLs query → join gsc_clicks.url_normalized against pages.url_normalized

### 7.4 Canonical Test Cases

These must all pass:

```typescript
normalizeUrl('/about/')                              // → '/about'
normalizeUrl('/About/US/')                           // → '/about/us'
normalizeUrl('/page?ref=gsc&source=email')           // → '/page'
normalizeUrl('/page#section')                        // → '/page'
normalizeUrl('https://colman.ac.il/about', 'colman.ac.il')   // → '/about'
normalizeUrl('https://www.colman.ac.il/about/', 'colman.ac.il') // → '/about'
normalizeUrl('http://colman.ac.il/research/', 'colman.ac.il') // → '/research'
normalizeUrl('/')                                    // → '/'
normalizeUrl('not a url!!!')                         // → null
normalizeUrl(null)                                   // → null
normalizeUrl(undefined)                              // → null
normalizeUrl('')                                     // → null
```

---

## Part 8: Vercel Deployment

### 8.1 Push to GitHub

```bash
git add .
git commit -m "v2.1.1 ready for deployment"
git push origin main
```

### 8.2 Import into Vercel

1. https://vercel.com → New Project → Import from GitHub
2. Framework: Next.js (auto-detected)
3. Root directory: `.`
4. Build command: `npm run build`
5. Output directory: `.next`

### 8.3 Set Environment Variables

In Vercel → Project Settings → Environment Variables. Apply to Production, Preview, and Development:

| Variable | Value | Client-visible |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | https://xxx.supabase.co | Yes |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | eyJ... | Yes |
| SUPABASE_SERVICE_ROLE_KEY | eyJ... | No — server only |
| CRON_SECRET | your-random-string | No — server only |

Do not prefix `SUPABASE_SERVICE_ROLE_KEY` or `CRON_SECRET` with `NEXT_PUBLIC_`. They must remain server-only.

### 8.4 Deploy and Verify Build

Click Deploy. Check Vercel → Deployments → latest → build logs for errors.

Common pre-deploy failures:
- TypeScript errors → run `npx tsc --noEmit` locally first
- Missing env vars → verify all 4 are set in Vercel

### 8.5 Update Supabase Redirect URLs

After first deploy, copy the Vercel app URL (e.g., `https://colman-sitemap.vercel.app`).  
Go to Supabase → Authentication → URL Configuration → add it to allowed URLs.

---

## Part 9: Presence Cleanup Cron

Presence rows older than 10 minutes are ignored by all queries. To prevent indefinite table growth, rows older than 30 days must be deleted on a schedule.

### 9.1 Create vercel.json

In the project root:

```json
{
  "crons": [
    {
      "path": "/api/presence/cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This calls the endpoint at 2:00 AM UTC daily.

### 9.2 Protect the Endpoint

The cleanup endpoint must not be publicly callable. Protect it by checking a shared secret:

```typescript
// app/api/presence/cleanup/route.ts

export async function POST(request: Request) {
  // Verify the request is from an authorized caller
  const authHeader = request.headers.get('authorization')
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role — this is an admin maintenance operation
  const adminSupabase = createServiceRoleClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { count, error } = await adminSupabase
    .from('presence')
    .delete({ count: 'exact' })
    .lt('last_seen', cutoff)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ deleted: count ?? 0 })
}
```

The caller (Vercel Cron, or any authorized scheduled job) must pass `Authorization: Bearer <CRON_SECRET>` in the request header. This is not automatic — your cron job or scheduler must be configured to send this header.

For Vercel Cron specifically, set `CRON_SECRET` in Vercel's environment variables and read it in the route as shown above. Vercel does not automatically inject it into cron requests; you must configure it explicitly in your project if using Vercel's cron trigger.

---

## Part 10: Behavioral Policies

### 10.1 Account Deactivation

When `accounts.is_active = false`:

- The account is hidden from regular users in all contexts:
  - Hidden from the account selector screen
  - Hidden from the account switcher dropdown
  - Cannot be selected or accessed
  - API endpoints return 403 for non-admin users attempting to access it
- Data remains fully intact: pages, activity_log, snapshots, gsc_clicks, user_accounts are not deleted
- System admins can still access inactive accounts (admin policies have no `is_active` filter)
- System admins can see inactive accounts in the admin panel with a visual "ארכיון" badge
- System admins can reactivate an account by setting `is_active = true`
- Archiving an account does not remove user assignments (they are preserved for if/when reactivated)

### 10.2 Concurrent Editing Policy

**Last Write Wins** — this is the intentional concurrency model for v2.1.

- No optimistic locking
- No page-level checkout or locking mechanism
- No conflict detection or merge resolution
- The most recent successful database write becomes the current state
- Realtime subscriptions propagate changes to all users within ~1 second, providing practical visibility into what others are doing
- If two users edit the same page simultaneously, the second save overwrites the first

This model is appropriate for the expected team sizes and usage patterns. Revisit if concurrent editing conflicts become a frequent user complaint.

### 10.3 Snapshot Retention

- v2.1 places no limit on the number of snapshots per account
- Snapshots are stored as JSONB in the `snapshots` table
- This is acceptable given expected sitemap sizes (hundreds to low thousands of pages)
- Monitor storage usage as snapshot count grows
- Revisit retention policy (e.g., max N snapshots per account, auto-expire after X months) if storage becomes a concern
- No implementation required in v2.1 — documentation only

### 10.4 Import Engine Limits

The following limits apply to the Intelligent Sitemap Import Engine to protect the system from expensive or abusive uploads:

| Limit | Value |
|---|---|
| Maximum file size | 10 MB |
| Maximum rows in uploaded file | 20,000 |
| Maximum proposed pages generated | 10,000 |

**Enforcement:** Limits are checked at the start of `POST /api/import/analyze` before any processing begins. If any limit is exceeded:
- Analysis stops immediately
- No `import_job` record is created
- A validation error is returned to the client with a clear message (e.g., "הקובץ גדול מדי — מקסימום 10MB")
- The user is shown the error in the import modal

These limits are checked in this order: file size first, then row count after initial parse, then proposed page count after analysis.

---

## Part 11: Post-Deployment Verification Tests

### 11.1 Authentication Tests

| Test | Expected |
|---|---|
| Navigate to /app without session | Redirects to /login |
| Navigate to /admin without session | Redirects to /login |
| Wrong credentials | "אימייל או סיסמה שגויים" shown |
| Correct credentials | Redirects away from /login |
| Non-admin navigates to /admin | Redirected to /app |
| System admin navigates to /admin | Admin panel loads |
| Refresh after login | Session persists |
| Logout | Redirects to /login, localStorage cleared |

### 11.2 Multi-Account Tests

| Test | Expected |
|---|---|
| User with 1 account logs in | No account selector, /app loads directly |
| User with 2+ accounts logs in | /select-account shows, sorted last-used first then alpha |
| System admin logs in | All accounts shown + "Create Account" button |
| User with 0 accounts | Empty state: "לא הוקצו לך חשבונות" |
| Return login (stored account) | Previously selected account auto-selected |
| Switch account | Tree, GSC, presence reload for new account |

### 11.3 Account Deactivation Tests

| Test | Expected |
|---|---|
| Admin archives Account A | is_active = false |
| Regular user logs in | Account A not visible in selector or switcher |
| Regular user calls GET /api/accounts | Account A not in response |
| System admin logs in | Account A visible in admin panel with "ארכיון" badge |
| Admin reactivates Account A | Regular users can see it again |
| Pages/data after archive + reactivate | All data intact |

### 11.4 RLS Isolation Tests

Run in Supabase SQL Editor with impersonated JWT:

```sql
-- Test: user A cannot see pages for Account B
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "user-a-uuid", "role": "authenticated"}';
SELECT count(*) FROM pages WHERE account_id = 'account-b-uuid';
-- Expected: 0

-- Test: user A cannot see activity for Account B
SELECT count(*) FROM activity_log WHERE account_id = 'account-b-uuid';
-- Expected: 0

-- Test: user A cannot see snapshots for Account B
SELECT count(*) FROM snapshots WHERE account_id = 'account-b-uuid';
-- Expected: 0

-- Test: user A cannot see GSC data for Account B
SELECT count(*) FROM gsc_clicks WHERE account_id = 'account-b-uuid';
-- Expected: 0

-- Test: system admin can see all accounts
SET LOCAL "request.jwt.claims" TO '{"sub": "admin-uuid", "role": "authenticated"}';
SELECT count(*) FROM accounts;
-- Expected: total account count (not filtered)
```

### 11.5 Page CRUD + Auto-Save Tests

| Test | Expected |
|---|---|
| Add root page | Appears in tree, saveStatus shows "נשמר ✓" |
| Add child page | Appears under parent |
| Edit page | Tree updates, saveStatus flashes |
| Delete leaf page | Removed from tree |
| Delete page with children | Confirm dialog shows child count, all deleted |
| Duplicate url_normalized | "כתובת זו כבר קיימת במפה" error, page not created |
| No global Save button | Confirm no Save button exists outside modals |
| Modal "שמור" button | Submits modal and immediately writes to DB |
| API failure | saveStatus = 'error', optimistic update reverted |

### 11.6 Concurrent Editing Test

1. Open two browser sessions for the same account
2. Session A edits page "Home", changes name to "Home v2"
3. Session B simultaneously edits page "Home", changes name to "Home v3"
4. Both save
5. Confirm: last save wins — tree shows whichever name was saved last
6. Confirm: no error, no crash, no merge dialog
7. Confirm: Realtime propagates final state to both sessions within ~1 second

### 11.7 URL Normalization Tests

```typescript
// Run these as unit tests or in a Node REPL after building:
import { normalizeUrl } from '@/lib/utils/url'

assert(normalizeUrl('/about/') === '/about')
assert(normalizeUrl('/About/US/') === '/about/us')
assert(normalizeUrl('/page?ref=gsc') === '/page')
assert(normalizeUrl('/page#section') === '/page')
assert(normalizeUrl('https://colman.ac.il/about', 'colman.ac.il') === '/about')
assert(normalizeUrl('https://www.colman.ac.il/about/', 'colman.ac.il') === '/about')
assert(normalizeUrl('/') === '/')
assert(normalizeUrl('not a url!!!') === null)
assert(normalizeUrl(null) === null)
assert(normalizeUrl('') === null)
```

### 11.8 GSC Import Tests

| Test | Expected |
|---|---|
| Admin uploads CSV (100 rows) | 100 rows in gsc_clicks for that account |
| Admin uploads second CSV (50 rows) | Old 100 rows deleted, 50 new rows exist |
| Upload for Account A | Account B gsc_clicks unchanged |
| URL "/about/" in CSV | Stored as url_normalized = "/about" |
| Absolute URL "https://colman.ac.il/about" (domain = colman.ac.il) | Stored as "/about" |
| Click count in tree | Badge appears next to matching page |
| Missing URLs tab | Shows only GSC URLs with no matching page.url_normalized |
| Missing URLs sorted | Highest clicks first |
| Add page from missing URL | URL pre-filled in Add Page modal |
| After page added | URL removed from Missing URLs tab |
| Non-admin calls POST /api/gsc | 403 Forbidden |

Sample test CSV:
```csv
url,clicks,impressions,ctr,position
/,12450,45000,0.2767,1.2
/admissions/,8920,32000,0.2788,2.1
/about/,3240,12000,0.2700,1.8
https://colman.ac.il/research/,892,4500,0.1982,3.4
```

Expected url_normalized values after upload (account domain = colman.ac.il):
- `/` → `/`
- `/admissions/` → `/admissions`
- `/about/` → `/about`
- `https://colman.ac.il/research/` → `/research`

### 11.9 Intelligent Import Engine Tests

#### Test A: File Size Limit

1. Upload a file larger than 10 MB
2. Expected: validation error returned immediately, no import_job created
3. Error message shown in import modal

#### Test B: Row Limit

1. Upload a valid CSV with 20,001 rows
2. Expected: validation error, no processing, no import_job created

#### Test C: Analyze Only (no sitemap change)

1. Upload a valid CSV with 10 URLs, mode = "Analyze Only"
2. Click "נתח"
3. Preview shows proposed pages
4. Cancel or close modal
5. Verify: sitemap unchanged, import_job status = 'cancelled' or 'ready_for_review'

#### Test D: Merge — Add Only

1. Existing pages: /page-a, /page-b
2. Import CSV: /page-a (existing), /page-c (new)
3. Mode: Merge, conflict_behavior: add_only
4. Preview shows: /page-a → existing_skip (gray), /page-c → new (green)
5. Apply
6. Verify: /page-a unchanged, /page-c created
7. Verify: auto-snapshot created before apply

#### Test E: Merge — Overwrite Existing

1. Existing page: /page-a with name "Old Name"
2. Import CSV: /page-a with name "New Name"
3. Mode: Merge, conflict_behavior: overwrite_existing
4. Preview shows: /page-a → existing_overwrite (blue)
5. Apply
6. Verify: /page-a name = "New Name", page ID unchanged

#### Test F: Create New Sitemap

1. Account has 20 pages
2. Import CSV with 5 URLs, mode = create_new_sitemap
3. Apply
4. Verify: all 20 original pages deleted, 5 new pages created
5. Verify: auto-snapshot created before deletion

#### Test G: Duplicate URLs in Import

1. CSV contains /page-a twice
2. Preview shows one as 'duplicate'
3. Apply
4. Verify: only one /page-a page created

#### Test H: Transactional Safety

1. Cause a DB failure partway through apply (e.g., introduce a constraint violation on row 5 of 10)
2. Verify: zero rows from the batch were applied (full rollback)
3. Verify: auto-snapshot was also rolled back (not created)
4. Verify: import_job status = 'failed'
5. Verify: sitemap unchanged from before the apply attempt

### 11.10 Clear Sitemap (Admin Danger Zone) Tests

**Transaction requirement:** Snapshot creation, sitemap deletion, and activity log entry occur inside a single database transaction. If any step fails, the entire transaction rolls back — the sitemap remains unchanged, no snapshot is created, and no activity is logged.

| Test | Expected |
|---|---|
| Regular user: Danger Zone section visible | Not visible |
| Regular user: POST DELETE /api/accounts/:id/sitemap | 403 Forbidden |
| Admin clicks "מחק מפה" | First confirmation modal with Hebrew warning text |
| Admin clicks "ביטול" (first modal) | Modal closes, nothing changes |
| Admin clicks "המשך" | Second confirmation modal with text input |
| Admin types wrong account name | Button stays disabled |
| Admin types partial name | Button stays disabled |
| Admin types correct name (different case) | Button enables (case-insensitive) |
| Admin clicks "ביטול" (second modal) | Modal closes, nothing changes |
| Admin types correct name and confirms | Execution begins |
| After success: auto-snapshot exists | Named "לפני מחיקת מפה — [account] — [date]" |
| After success: all pages deleted | Tree shows empty state |
| After success: account exists | Visible in admin accounts list |
| After success: user assignments intact | user_accounts rows unchanged |
| After success: GSC data intact | gsc_clicks rows unchanged |
| After success: activity log entry | sitemap_cleared with deleted_page_count, backup_snapshot_id |
| After success: other accounts | Other accounts' pages completely unaffected |
| Transaction failure mid-execution | Sitemap unchanged, snapshot not created, activity not logged |

### 11.11 Presence Tests

| Test | Expected |
|---|---|
| User A online | Green dot in presence bar |
| User B joins same account | User A sees B within 30 seconds |
| User C joins different account | Not visible to User A |
| More than 5 users online | "+N עוד" appears |
| Click "+N עוד" | Popover shows all online users |
| User B inactive 2+ min | Yellow dot "לא פעיל X דקות" |
| User B inactive 10+ min | Removed from presence display |
| Switch account | Presence updates for new account |

### 11.12 Snapshot Tests

| Test | Expected |
|---|---|
| Create snapshot | Appears in list with correct page count |
| Export snapshot | Valid JSON downloads |
| Delete snapshot | Removed after confirmation |
| Restore snapshot | Auto-backup created first, tree updated |
| Restore is transactional | If it fails, sitemap is unchanged, no backup snapshot created |
| Compare snapshot | Two-column view with color coding |
| Account B snapshots | Not visible in Account A's snapshot list |

### 11.13 Activity Feed Tests

| Test | Expected |
|---|---|
| Add page | 'page_created' entry in feed |
| Edit page | 'page_edited' with old and new values |
| Delete page | 'page_deleted' entry |
| Bulk operation | Single bulk entry, not one per page |
| GSC upload | 'gsc_uploaded' with record count |
| Import applied | 'import_applied' with created/updated/skipped counts |
| Sitemap cleared | 'sitemap_cleared' with deleted_page_count and backup_snapshot_id |
| Account B activity | Not visible when viewing Account A's feed |
| Filter by user | Only that user's entries |
| Filter by date range | Only entries in range |
| Filter by action type | Only matching entries |

---

## Part 12: Common Errors and Fixes

### Error: "relation does not exist" during migration

You applied a policy before the referenced table was created. This happens if you ran Pass A and Pass B steps out of order, or combined them.

**Fix:** If you encounter this mid-migration, check what already exists:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```
Drop the partially-created table if necessary, then re-run from the correct step.

### Error: "new row violates row-level security policy"

The user's session does not have access to the account being written. Possible causes:
- User is not assigned to the account (check user_accounts)
- Route is incorrectly using the service role where it should use the user session
- RLS policy for INSERT is missing or incorrect

**Fix:** Verify the route uses the user's session for standard operations. Check that the user has a row in `user_accounts` for the target account.

### Error: "duplicate key value violates unique constraint idx_pages_unique_normalized_url"

Two pages in the same account have the same normalized URL. This is enforced by design.

**Fix:** Show the user a Hebrew error in the modal: "כתובת זו כבר קיימת במפה." Do not allow the operation. The import engine must detect duplicates during analysis (before apply) so this error should not surface during import.

### Error: Realtime updates not received

- Verify the 4 tables are in the `supabase_realtime` publication (run Part 6 SQL)
- Verify the channel filter uses the correct account_id
- Verify the user's RLS SELECT policy allows reading the subscribed table

### Error: /admin redirects to /app after login

The middleware is not recognizing system_admin role. Verify:
```sql
SELECT role FROM profiles WHERE id = 'your-user-uuid';
-- Must return 'system_admin'
```

If not, re-run Step 5.3. If it returns the right value, check that your middleware reads the profile correctly from the user session.

### Error: Cron endpoint returns 401

The caller is not sending `Authorization: Bearer <CRON_SECRET>`. Verify the CRON_SECRET matches between the caller and the environment variable. For manual testing:
```bash
curl -X POST https://your-app.vercel.app/api/presence/cleanup \
  -H "Authorization: Bearer your-cron-secret"
```

---

## Part 13: Migration Verification Checklist

Run after completing all migration steps:

```sql
-- 1. All 9 tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
-- Expected: accounts, activity_log, gsc_clicks, import_jobs, pages,
--           presence, profiles, snapshots, user_accounts

-- 2. RLS enabled on all tables
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- Expected: rowsecurity = true for all 9

-- 3. Enums exist
SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname;
-- Expected: import_conflict_behavior, import_job_status, import_mode, page_status

-- 4. URL uniqueness index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'pages' AND indexname = 'idx_pages_unique_normalized_url';
-- Expected: 1 row

-- 5. Profile auto-create trigger exists
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'trg_on_auth_user_created';
-- Expected: 1 row

-- 6. System admin exists
SELECT id, display_name, role FROM profiles WHERE role = 'system_admin';
-- Expected: at least 1 row

-- 7. Initial account seeded
SELECT id, name, slug, domain, is_active FROM accounts;
-- Expected: at least 1 row

-- 8. Realtime publication includes required tables
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Expected: pages, presence, activity_log, snapshots all listed
```
