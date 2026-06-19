# Database.md — Colman Site Structure Manager v2
**Version:** 2.1.1  
**Status:** Final  
**Date:** 2026-06-19  
**Audience:** Claude Code (implementation reference)

---

## 1. Security Model

### 1.1 RLS is the Source of Truth

Row Level Security (RLS) is the primary mechanism for account isolation. Every table that holds account-specific data has RLS policies that enforce isolation at the database level.

**RLS policies are not optional.** They are not backed up by API-level checks — they are the definitive access boundary. API-level account access checks are defense-in-depth and validate context before hitting the DB, but they do not replace RLS.

If an API route has a bug that skips an access check, RLS still prevents unauthorized data access. This layered security model is intentional.

### 1.2 Service Role Usage

The Supabase service role key bypasses RLS. It must be used sparingly and only in specific contexts:
- System admin operations: creating/archiving accounts, managing user roles, assigning users
- Supabase Auth admin operations (e.g., listing users via auth.admin)
- Trusted server-only maintenance operations (e.g., scheduled presence cleanup)
- Operations that cannot work with user-scoped RLS by design

**The service role key must never be exposed to the client.** It must only be used in server-side code (Next.js API routes running on the server). All normal authenticated routes must use the user's Supabase session, which respects RLS automatically.

---

## 2. Tables Overview

| Table | Purpose |
|---|---|
| accounts | Client accounts (Colman, White Web Worx, etc.) |
| profiles | Extended user info, role |
| user_accounts | Many-to-many: users to accounts |
| pages | Sitemap pages for each account |
| activity_log | Per-account event history |
| snapshots | Immutable named tree copies |
| gsc_clicks | GSC URL click data per account |
| presence | Who is online in each account |
| import_jobs | Import analysis and apply job tracking |

---

## 3. Table: accounts

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

### RLS: accounts

```sql
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_admin_all_accounts"
  ON accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

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

### Sample Data

```sql
INSERT INTO accounts (name, slug, domain) VALUES
  ('Colman', 'colman', 'colman.ac.il'),
  ('White Web Worx', 'white-web-worx', 'whiteweb.co.il');
```

### Account Deactivation Behavior

When `is_active = false`:
- The `user_assigned_accounts` RLS policy filters inactive accounts out for all regular users (`is_active = true` condition in the policy)
- System admins still see all accounts via `system_admin_all_accounts` policy (no `is_active` filter)
- All account data (pages, snapshots, activity_log, gsc_clicks, user_accounts) is preserved
- Account can be reactivated at any time: `UPDATE accounts SET is_active = true WHERE id = '...'`
- Do not cascade-delete or modify user_accounts rows when archiving

---

## 4. Table: profiles

One row per auth.users entry. Created automatically by trigger on user signup.

```sql
CREATE TABLE profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  role         text NOT NULL DEFAULT 'user' CHECK (role IN ('system_admin', 'user')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);

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

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### RLS: profiles

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile_select"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can only update display_name; role cannot be changed by user
CREATE POLICY "own_profile_update"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY "system_admin_all_profiles"
  ON profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
    )
  );

-- Users in the same account can read each other's display_name (for activity feed + presence)
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

---

## 5. Table: user_accounts

Many-to-many relationship between users and accounts.

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

### RLS: user_accounts

```sql
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_admin_all_user_accounts"
  ON user_accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "user_own_assignments_select"
  ON user_accounts FOR SELECT
  USING (user_id = auth.uid());
```

---

## 6. Table: pages

The sitemap for each account. Every row belongs to exactly one account.

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

-- Standard indexes
CREATE INDEX idx_pages_account_id ON pages(account_id);
CREATE INDEX idx_pages_parent_id ON pages(parent_id);
CREATE INDEX idx_pages_account_parent ON pages(account_id, parent_id);
CREATE INDEX idx_pages_account_sort ON pages(account_id, sort_order);
CREATE INDEX idx_pages_status ON pages(account_id, status);
CREATE INDEX idx_pages_url ON pages(account_id, url);
CREATE INDEX idx_pages_url_normalized ON pages(account_id, url_normalized);

-- URL uniqueness: no two pages in the same account may share a normalized URL
-- WHERE url_normalized IS NOT NULL prevents the constraint from blocking pages with no URL
CREATE UNIQUE INDEX idx_pages_unique_normalized_url
  ON pages(account_id, url_normalized)
  WHERE url_normalized IS NOT NULL;

CREATE TRIGGER trg_pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

Note on url_normalized: whenever a page's url is set or updated, the API route must compute and store url_normalized using the shared URL normalization function. This keeps the normalized form always in sync.

**Canonical URL normalization function:** `lib/utils/url.ts` → `normalizeUrl(rawUrl, accountDomain)`. This single function is used by all 4 subsystems that need URL normalization: sitemap CRUD, GSC import, intelligent import engine, and missing URLs matching. Never implement ad-hoc URL comparison — always call this function.

### RLS: pages

```sql
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- RLS is the source of truth for account isolation.
-- API access checks are additional validation, not a replacement for RLS.

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

---

## 7. Table: activity_log

Immutable append-only event log per account.

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

### Action Values

```
page_created | page_edited | page_deleted | page_moved | status_changed
bulk_delete | bulk_move | bulk_status | bulk_template | bulk_color | bulk_note
gsc_uploaded
json_exported
import_analyzed | import_applied | import_cancelled
snapshot_created | snapshot_restored | snapshot_deleted
sitemap_cleared
user_added | user_removed
```

### Retention Policy

Keep activity log indefinitely for v2. Revisit archive/export policy after 24 months or if table growth becomes a performance concern.

### RLS: activity_log

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

-- INSERT only via server-side API routes using service role or user session
-- No direct INSERT policy for regular users via client
```

---

## 8. Table: snapshots

Immutable named copies of the full sitemap.

Snapshot data is stored as JSONB. This is acceptable for v2 given expected sitemap sizes (hundreds to low thousands of pages per account). If account count, page count, or snapshot count grows significantly, revisit this storage strategy (consider S3/object storage).

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

The data column contains a JSON array of all page rows at the time of snapshot (id, parent_id, name, url, url_normalized, color, template, status, notes, sort_order). Snapshots are immutable: no UPDATE policy is defined.

### RLS: snapshots

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

---

## 9. Table: gsc_clicks

GSC traffic data per account. Enhanced with normalization fields and additional GSC metrics.

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

### Upload Strategy

When GSC data is uploaded:
1. Delete all existing rows WHERE account_id = target_account_id (done inside a transaction)
2. Normalize each URL from the CSV using the shared normalization function
3. Insert new rows with url_original (raw from CSV) and url_normalized (computed)
4. This must be done via a server-side API route, never via direct client writes

### RLS: gsc_clicks

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

---

## 10. Table: presence

Who is currently online in each account.

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

### Heartbeat Logic

Client sends UPSERT every 30 seconds:
```sql
INSERT INTO presence (user_id, account_id, display_name, last_seen)
VALUES (auth.uid(), :account_id, :display_name, now())
ON CONFLICT (user_id, account_id)
DO UPDATE SET last_seen = now(), display_name = EXCLUDED.display_name;
```

To get currently online users:
```sql
SELECT user_id, display_name, last_seen
FROM presence
WHERE account_id = :account_id
AND last_seen > now() - interval '10 minutes'
ORDER BY last_seen DESC;
```

Active (green) = last_seen within 2 minutes.
Inactive (yellow) = last_seen 2–10 minutes ago.

### Presence Cleanup

Presence rows older than 10 minutes are simply ignored by all queries (they are never "soft deleted" in real-time). However, to prevent indefinite table growth, a scheduled job must delete presence rows older than 30 days. This can be implemented as:
- A Supabase Database Function triggered by pg_cron (if available on the plan)
- A scheduled Next.js API route called by Vercel Cron Jobs

```sql
-- Cleanup function (call via cron)
DELETE FROM presence WHERE last_seen < now() - interval '30 days';
```

### RLS: presence

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

CREATE POLICY "user_own_presence_upsert"
  ON presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_own_presence_update"
  ON presence FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "user_own_presence_delete"
  ON presence FOR DELETE
  USING (user_id = auth.uid());
```

---

## 11. Table: import_jobs

Tracks import analysis and apply operations. Allows users to review past imports and enables the analysis-then-apply workflow.

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

### RLS: import_jobs

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

### Import Engine Performance Limits

The following limits are enforced by the API before any analysis begins. They are application-level constraints, not database constraints:

| Limit | Value | Enforcement Point |
|---|---|---|
| Maximum file size | 10 MB | `POST /api/import/analyze` — checked before parsing |
| Maximum rows in file | 20,000 | Checked immediately after initial parse |
| Maximum proposed pages | 10,000 | Checked after analysis, before saving job |

If any limit is exceeded, the request returns a validation error and no `import_jobs` row is created.

### Concurrent Editing Policy

The database does not implement optimistic locking or row-level checkout. **Last Write Wins** is the intentional concurrency model for v2.1. The most recent successful UPDATE to any row becomes the current state. Realtime subscriptions propagate the updated state to all connected users within ~1 second.

---

## 12. Shared Trigger Function

Run once before any CREATE TABLE statements:

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 13. Realtime Subscriptions

Enable Realtime on these tables in Supabase Dashboard (Database → Replication):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE pages;
ALTER PUBLICATION supabase_realtime ADD TABLE presence;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE snapshots;
```

The client subscribes only to events for the currently active account_id. Use Realtime channel filter on account_id.

---

## 14. Run Order for Migrations

**CRITICAL: Create all tables first, then apply all RLS policies.** Do not interleave. RLS policies can reference tables that don't exist yet, which causes SQL errors in a clean project.

**Pass A — Create all tables (no RLS):**

1. `update_updated_at()` function
2. accounts table
3. profiles table + handle_new_user trigger
4. user_accounts table
5. page_status enum + pages table (with url_normalized column and unique index)
6. activity_log table
7. snapshots table
8. gsc_clicks table
9. presence table
10. import_job_status, import_mode, import_conflict_behavior enums + import_jobs table

**Pass B — Enable RLS and create all policies (all tables exist):**

11. RLS for accounts
12. RLS for profiles
13. RLS for user_accounts
14. RLS for pages
15. RLS for activity_log
16. RLS for snapshots
17. RLS for gsc_clicks
18. RLS for presence
19. RLS for import_jobs
20. Realtime publication additions

---

## 15. Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

The service role key is used ONLY in specific server-side API routes as documented in §1.2. It must never be exposed to the client.

---

## 16. First System Admin

After running migrations:

```sql
-- Find user ID
SELECT id, email FROM auth.users WHERE email = 'your-admin@email.com';

-- Elevate to system_admin
UPDATE profiles SET role = 'system_admin' WHERE id = '<user-id>';
```

---

## 17. Verification Queries

```sql
-- All tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- RLS enabled on all tables
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Enum values
SELECT unnest(enum_range(NULL::page_status));
SELECT unnest(enum_range(NULL::import_job_status));

-- Unique URL index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'pages' AND indexname = 'idx_pages_unique_normalized_url';

-- Profile trigger exists
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'users';
```
