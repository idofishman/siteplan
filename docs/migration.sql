-- =============================================================================
-- Colman Site Structure Manager v2 — Full Database Migration
-- Version: 2.1.1
-- Run in Supabase Dashboard → SQL Editor → New Query
--
-- STRATEGY: Two-pass migration.
--   Pass A: Create all tables and triggers (no RLS yet).
--   Pass B: Enable RLS and create all policies (all tables exist by now).
--   Pass C: Seed initial data + enable Realtime.
--
-- CRITICAL: Do NOT interleave table creation and policy creation.
-- Some policies reference tables that don't exist yet, which causes
-- "relation does not exist" errors in a clean project.
-- =============================================================================


-- =============================================================================
-- PASS A — CREATE ALL TABLES (NO RLS)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- A-1: Shared trigger function (run FIRST — used by multiple tables)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- -----------------------------------------------------------------------------
-- A-2: accounts
-- -----------------------------------------------------------------------------

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

CREATE INDEX idx_accounts_slug      ON accounts(slug);
CREATE INDEX idx_accounts_is_active ON accounts(is_active);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- -----------------------------------------------------------------------------
-- A-3: profiles + auto-create trigger on auth.users INSERT
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- A-4: user_accounts (many-to-many: users ↔ accounts)
-- -----------------------------------------------------------------------------

CREATE TABLE user_accounts (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, account_id)
);

CREATE INDEX idx_user_accounts_user_id    ON user_accounts(user_id);
CREATE INDEX idx_user_accounts_account_id ON user_accounts(account_id);


-- -----------------------------------------------------------------------------
-- A-5: pages (sitemap hierarchy)
-- -----------------------------------------------------------------------------

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

CREATE INDEX idx_pages_account_id     ON pages(account_id);
CREATE INDEX idx_pages_parent_id      ON pages(parent_id);
CREATE INDEX idx_pages_account_parent ON pages(account_id, parent_id);
CREATE INDEX idx_pages_account_sort   ON pages(account_id, sort_order);
CREATE INDEX idx_pages_status         ON pages(account_id, status);
CREATE INDEX idx_pages_url            ON pages(account_id, url);
CREATE INDEX idx_pages_url_normalized ON pages(account_id, url_normalized);

-- No two pages in the same account may share a normalized URL.
-- WHERE url_normalized IS NOT NULL allows pages with no URL to coexist freely.
CREATE UNIQUE INDEX idx_pages_unique_normalized_url
  ON pages(account_id, url_normalized)
  WHERE url_normalized IS NOT NULL;

CREATE TRIGGER trg_pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- -----------------------------------------------------------------------------
-- A-6: activity_log (append-only event log per account)
-- -----------------------------------------------------------------------------

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

-- No updated_at — activity_log rows are immutable after insert.

CREATE INDEX idx_activity_log_account_id      ON activity_log(account_id);
CREATE INDEX idx_activity_log_account_created ON activity_log(account_id, created_at DESC);
CREATE INDEX idx_activity_log_user_id         ON activity_log(account_id, user_id);
CREATE INDEX idx_activity_log_action          ON activity_log(account_id, action);


-- -----------------------------------------------------------------------------
-- A-7: snapshots (immutable named tree copies stored as JSONB)
-- -----------------------------------------------------------------------------

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

-- No updated_at or UPDATE trigger — snapshots are immutable after creation.

CREATE INDEX idx_snapshots_account_id      ON snapshots(account_id);
CREATE INDEX idx_snapshots_account_created ON snapshots(account_id, created_at DESC);


-- -----------------------------------------------------------------------------
-- A-8: gsc_clicks (Google Search Console data per account)
-- -----------------------------------------------------------------------------

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

CREATE INDEX idx_gsc_clicks_account_id     ON gsc_clicks(account_id);
CREATE INDEX idx_gsc_clicks_account_url    ON gsc_clicks(account_id, url_normalized);
CREATE INDEX idx_gsc_clicks_account_clicks ON gsc_clicks(account_id, clicks DESC);


-- -----------------------------------------------------------------------------
-- A-9: presence (who is currently online per account)
-- -----------------------------------------------------------------------------

CREATE TABLE presence (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  last_seen    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, account_id)
);

CREATE INDEX idx_presence_account_id ON presence(account_id);
CREATE INDEX idx_presence_last_seen  ON presence(account_id, last_seen);


-- -----------------------------------------------------------------------------
-- A-10: import_jobs (tracks import analysis + apply operations)
-- -----------------------------------------------------------------------------

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

CREATE INDEX idx_import_jobs_account_id      ON import_jobs(account_id);
CREATE INDEX idx_import_jobs_account_created ON import_jobs(account_id, created_at DESC);
CREATE INDEX idx_import_jobs_status          ON import_jobs(account_id, status);


-- =============================================================================
-- PASS B — ENABLE RLS AND CREATE ALL POLICIES
-- All 9 tables now exist. Safe to reference any table in any policy.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- B-1: accounts RLS
-- -----------------------------------------------------------------------------

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- System admins can read and write all accounts (active or inactive)
CREATE POLICY "system_admin_all_accounts"
  ON accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

-- Regular users can only see active accounts they are explicitly assigned to
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


-- -----------------------------------------------------------------------------
-- B-2: profiles RLS
-- -----------------------------------------------------------------------------

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
-- (required for activity feed and presence display)
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


-- -----------------------------------------------------------------------------
-- B-3: user_accounts RLS
-- -----------------------------------------------------------------------------

ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;

-- System admins can manage all user-account assignments
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


-- -----------------------------------------------------------------------------
-- B-4: pages RLS
-- RLS is the source of truth for account isolation.
-- API-level checks are defense-in-depth, not a replacement for RLS.
-- -----------------------------------------------------------------------------

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

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


-- -----------------------------------------------------------------------------
-- B-5: activity_log RLS
-- -----------------------------------------------------------------------------

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

-- No INSERT policy for regular users — activity_log is written only by
-- server-side API routes using the user's session or the service role.


-- -----------------------------------------------------------------------------
-- B-6: snapshots RLS
-- -----------------------------------------------------------------------------

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

-- NO UPDATE policy: snapshots are immutable after creation.


-- -----------------------------------------------------------------------------
-- B-7: gsc_clicks RLS
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- B-8: presence RLS
-- -----------------------------------------------------------------------------

ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

-- Users can see other presence rows in their own accounts; admins see all.
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

-- Users can only upsert/update/delete their own presence row.
CREATE POLICY "user_own_presence_insert"
  ON presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_own_presence_update"
  ON presence FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "user_own_presence_delete"
  ON presence FOR DELETE
  USING (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- B-9: import_jobs RLS
-- -----------------------------------------------------------------------------

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


-- =============================================================================
-- PASS C — SEED INITIAL DATA + ENABLE REALTIME
-- =============================================================================


-- -----------------------------------------------------------------------------
-- C-1: Seed initial accounts
-- Add or remove rows as needed for your deployment.
-- -----------------------------------------------------------------------------

INSERT INTO accounts (name, slug, domain) VALUES
  ('Colman', 'colman', 'colman.ac.il');

-- Add more accounts as needed:
-- INSERT INTO accounts (name, slug, domain) VALUES ('White Web Worx', 'white-web-worx', 'whiteweb.co.il');


-- -----------------------------------------------------------------------------
-- C-2: Enable Realtime on required tables
-- Must be done AFTER all tables exist.
-- -----------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE pages;
ALTER PUBLICATION supabase_realtime ADD TABLE presence;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE snapshots;


-- =============================================================================
-- VERIFICATION QUERIES
-- Run these after migration to confirm everything is correct.
-- =============================================================================

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

-- 4. URL uniqueness partial index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'pages' AND indexname = 'idx_pages_unique_normalized_url';
-- Expected: 1 row

-- 5. Profile auto-create trigger exists
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'trg_on_auth_user_created';
-- Expected: 1 row

-- 6. Realtime publication includes required tables
SELECT schemaname, tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
-- Expected: activity_log, pages, presence, snapshots all listed
