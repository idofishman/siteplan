# Implementation-Plan.md — Colman Site Structure Manager v2
**Version:** 2.1.1  
**Status:** Final  
**Date:** 2026-06-19  
**Audience:** Claude Code — implement phases in order, do not skip ahead

---

## How to Use This Document

Implement phases in order (0 through 14). Each phase has a clear goal, list of files to create, database changes, API endpoints, and acceptance criteria. Do not proceed to the next phase until all acceptance criteria for the current phase are met.

Do NOT implement Phase 11, 12, or 13 before:
- Multi-account architecture (Phase 3) is working
- Account permissions (Phase 2) is working
- Core sitemap CRUD (Phase 5) is working
- Activity log (Phase 9) is working
- Snapshots (Phase 10) is working

---

## Constants Reference

### COLORS (16)
```typescript
export const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#F43F5E', '#A855F7', '#0EA5E9', '#22C55E',
  '#64748B',
]
```

### TEMPLATES (22)
```typescript
export const TEMPLATES = [
  'page', 'hub', 'homepage', 'faculty', 'department', 'degree',
  'blog', 'blog-post', 'course', 'staff', 'staff-directory',
  'research', 'research-center', 'research-network',
  'registration', 'campus', 'student-life', 'portal',
  'event', 'form', 'archive', 'gallery',
]
```

### STATUS_LABELS (Hebrew)
```typescript
export const STATUS_LABELS: Record<PageStatus, string> = {
  planned: 'מתוכנן',
  existing: 'קיים',
  in_progress: 'בעבודה',
  needs_review: 'ממתין לאישור',
  approved: 'מאושר',
  deprecated: 'מיושן',
  redirect: 'ריידיירקט',
  archived: 'בארכיון',
}
```

### STATUS_COLORS
```typescript
export const STATUS_COLORS: Record<PageStatus, { bg: string; text: string }> = {
  planned:      { bg: '#EFF6FF', text: '#3B82F6' },
  existing:     { bg: '#F0FDF4', text: '#16A34A' },
  in_progress:  { bg: '#FFF7ED', text: '#EA580C' },
  needs_review: { bg: '#FEFCE8', text: '#CA8A04' },
  approved:     { bg: '#F0FDF4', text: '#15803D' },
  deprecated:   { bg: '#F1F5F9', text: '#64748B' },
  redirect:     { bg: '#FDF4FF', text: '#9333EA' },
  archived:     { bg: '#FFF1F2', text: '#E11D48' },
}
```

---

## Phase 0: Project Setup

### Goal
Initialize the Next.js project with all dependencies, directory structure, and base configuration.

### Files to Create

- `package.json`
- `tsconfig.json` — strict mode
- `tailwind.config.ts`
- `postcss.config.js`
- `next.config.js`
- `.env.local` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
- `.env.example`
- `.gitignore`
- `app/layout.tsx` — `<html lang="he" dir="rtl">`
- `app/globals.css` — Tailwind directives
- `lib/constants.ts` — COLORS, TEMPLATES, STATUS_LABELS, STATUS_COLORS
- `lib/utils/cn.ts` — clsx + twMerge
- `types/index.ts` — all TypeScript interfaces from Architecture.md §4
- `lib/utils/url.ts` — normalizeUrl() function from Architecture.md §5

### Dependencies

```json
{
  "dependencies": {
    "next": "14",
    "@supabase/supabase-js": "^2",
    "@supabase/ssr": "^0.1",
    "zustand": "^4",
    "clsx": "^2",
    "tailwind-merge": "^2",
    "@hello-pangea/dnd": "^16",
    "xlsx": "^0.18"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "tailwindcss": "^3",
    "autoprefixer": "^10",
    "postcss": "^8"
  }
}
```

### Acceptance Criteria

- [ ] `npm run dev` starts without errors on http://localhost:3000
- [ ] `npx tsc --noEmit` outputs 0 errors
- [ ] Tailwind applies: test with `className="text-blue-500"`
- [ ] .env.local exists with all 3 keys (not committed)
- [ ] normalizeUrl('/about/') returns '/about'
- [ ] normalizeUrl('https://colman.ac.il/about', 'colman.ac.il') returns '/about'
- [ ] normalizeUrl('/about?ref=gsc') returns '/about'

### Tests to Run

```bash
npm run dev
npx tsc --noEmit

# Test normalizeUrl in Node REPL:
node -e "const {normalizeUrl} = require('./lib/utils/url'); console.log(normalizeUrl('/about/'))"
```

---

## Phase 1: Supabase Setup and Database

### Goal
Create all database tables, RLS policies, enums, and Realtime configuration.

### Database Work — CRITICAL: Two-Pass Migration

**Do NOT interleave table creation and RLS policy creation.** Some policies reference tables that don't exist yet. Apply all tables first, then all policies.

**Pass A — Create all tables (no RLS):**

1. `update_updated_at()` function
2. `accounts` table
3. `profiles` table + `handle_new_user` trigger
4. `user_accounts` table
5. `page_status` enum + `pages` table (include url_normalized column and unique partial index)
6. `activity_log` table
7. `snapshots` table
8. `gsc_clicks` table (include url_normalized, url_original, impressions, ctr, position, uploaded_by)
9. `presence` table
10. `import_job_status`, `import_mode`, `import_conflict_behavior` enums + `import_jobs` table

**Pass B — Enable RLS and create all policies (all tables now exist):**

11. RLS for accounts, profiles, user_accounts, pages, activity_log, snapshots, gsc_clicks, presence, import_jobs

**Pass C:**

12. Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE pages, presence, activity_log, snapshots;`

Full SQL for each step is in Database.md. Deployment.md has the complete migration in correct order.

### Files to Create

- `lib/supabase/client.ts` — `createBrowserClient`
- `lib/supabase/server.ts` — `createServerClient` (uses user session cookies)
- `lib/supabase/admin.ts` — `createServiceRoleClient` (uses SUPABASE_SERVICE_ROLE_KEY, server-side only)
- `lib/utils/auth.ts` — `verifyAccountAccess()`, `requireSystemAdmin()`

### Acceptance Criteria

- [ ] All 9 tables exist in Supabase
- [ ] RLS enabled on all tables (verify with pg_tables query)
- [ ] `handle_new_user` trigger auto-creates profile on auth.users INSERT
- [ ] `idx_pages_unique_normalized_url` partial unique index exists on pages
- [ ] First admin user manually elevated to system_admin
- [ ] Realtime enabled on pages, presence, activity_log, snapshots
- [ ] `normalizeUrl` is used in admin.ts as a pre-flight test: normalizeUrl('/test/') === '/test'

### Tests to Run

```sql
-- All tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- RLS enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Enums
SELECT unnest(enum_range(NULL::page_status));
SELECT unnest(enum_range(NULL::import_job_status));

-- URL uniqueness index
SELECT indexname FROM pg_indexes WHERE tablename = 'pages' AND indexname = 'idx_pages_unique_normalized_url';
```

---

## Phase 2: Authentication

### Goal
Login/logout with route protection via middleware.

### Files to Create

- `app/login/page.tsx`
- `app/login/actions.ts` — server action for signInWithPassword
- `components/auth/AuthProvider.tsx` — auth state listener
- `middleware.ts` — protect /app/* and /admin/*
- `app/page.tsx` — root redirect

### API Endpoints

None (uses Supabase Auth directly via user session).

### Acceptance Criteria

- [ ] Visiting /app while logged out → redirects to /login
- [ ] Wrong credentials → "אימייל או סיסמה שגויים" in Hebrew
- [ ] Correct credentials → redirects away from /login
- [ ] Session persists across browser refresh
- [ ] Non-admin visiting /admin → redirects to /app

### Tests to Run

1. Incognito → navigate to /app → confirm redirect to /login
2. Wrong credentials → confirm Hebrew error shown
3. Correct credentials → confirm redirect
4. Refresh after login → confirm still logged in
5. Non-admin → navigate to /admin → confirm redirect to /app

---

## Phase 3: Account Selection and Switching

### Goal
Route user to correct account after login. Show account switcher in header.

### Files to Create

- `app/select-account/page.tsx`
- `components/account/AccountSelector.tsx`
- `components/account/AccountSwitcher.tsx`
- `stores/accountStore.ts`
- `app/app/layout.tsx` — app shell header
- `lib/utils/auth.ts` — add account access helper

### API Endpoints

```
GET /api/accounts
  Auth: user session (RLS returns only accessible accounts)
  Admin: all active accounts
  User: only assigned active accounts
  Response: Account[]
```

### Acceptance Criteria

- [ ] User with 1 account → login → no selector → /app loads with that account
- [ ] User with 2+ accounts → /select-account → cards sorted: last used first, then alphabetical
- [ ] System admin → sees all accounts + "Create Account" button
- [ ] Returning user with stored account → auto-selected on login
- [ ] Account switcher in header shows current account name
- [ ] Switching account → app reloads with new account data
- [ ] Account with 0 assignments → empty state: "לא הוקצו לך חשבונות"

### Tests to Run

1. Login as 1-account user → confirm no selector
2. Login as 2-account user → confirm selector with 2 cards
3. Login as admin → confirm all accounts shown
4. Select account A → switch to B → confirm header shows B
5. Logout + login → confirm previous account auto-selected

---

## Phase 4: Core Tree — Load and Display

### Goal
Load and display the page tree for the active account.

### Files to Create

- `app/app/page.tsx`
- `components/tree/PageTree.tsx`
- `components/tree/PageNode.tsx`
- `stores/treeStore.ts` — loadPages, pages, tree (derived), gscClicks
- `stores/uiStore.ts` — expandedNodeIds, toggleExpand, selectedPageIds
- `lib/utils/tree.ts` — buildTree, flatTree, findNode, getDescendantIds, getAffectedDeleteCount

### API Endpoints

```
GET /api/pages?account_id=:id
  Auth: user session (RLS scopes to account)
  Response: Page[]
```

### Acceptance Criteria

- [ ] Pages load from Supabase when account selected
- [ ] Correct parent-child hierarchy in tree
- [ ] Expand/collapse works
- [ ] Expanded state persists in localStorage (sitemap_expanded_nodes)
- [ ] Each node shows: color swatch, name, status badge
- [ ] Empty state when account has 0 pages
- [ ] getAffectedDeleteCount correctly counts selected + all descendants

### Tests to Run

1. Account with 0 pages → empty state
2. Account with pages → correct hierarchy
3. Expand node → refresh → stays expanded
4. Verify status badge colors match STATUS_COLORS

---

## Phase 5: Page CRUD with Auto-Save

### Goal
Add, edit, delete pages with auto-save. No manual save button.

### Files to Create

- `components/modals/AddEditPageModal.tsx`
- `components/modals/DeleteConfirmModal.tsx`
- `components/ui/SaveIndicator.tsx`
- `components/ui/StatusBadge.tsx`
- `components/ui/ColorSwatch.tsx`
- `components/ui/TemplateSelect.tsx`
- `components/tree/PageNodeMenu.tsx`
- `lib/utils/activity.ts` — logActivity() called from API routes

### API Endpoints

```
POST /api/pages
  Auth: user session
  Body: { account_id, parent_id?, name, url?, color?, template?, status, notes?, sort_order }
  Logic: compute url_normalized via normalizeUrl(url, account.domain) before INSERT
  Side effect: log page_created
  Response: Page

PATCH /api/pages/:id
  Auth: user session
  Body: Partial<Page>
  Logic: if url changed, recompute url_normalized; check uniqueness
  Side effect: log page_edited with old and new values
  Response: Page

DELETE /api/pages/:id
  Auth: user session
  Logic: cascade delete children (DB handles via ON DELETE CASCADE)
  Side effect: log page_deleted
  Response: { deleted_count }
```

### Auto-Save Pattern (implement in treeStore for every mutation)

```typescript
async addPage(data) {
  const tempId = crypto.randomUUID()
  set(state => ({ pages: [...state.pages, { ...data, id: tempId }], saveStatus: 'saving' }))
  try {
    const page = await apiFetch('/api/pages', { method: 'POST', body: data })
    set(state => ({
      pages: state.pages.map(p => p.id === tempId ? page : p),
      saveStatus: 'saved'
    }))
    setTimeout(() => set({ saveStatus: 'idle' }), 3000)
  } catch (e) {
    set(state => ({
      pages: state.pages.filter(p => p.id !== tempId),
      saveStatus: 'error'
    }))
  }
}
```

### Acceptance Criteria

- [ ] Add page → appears in tree, saveStatus flashes 'saved'
- [ ] Edit page → tree updates, saveStatus flashes 'saved'
- [ ] Delete page with children → warning shown → all deleted on confirm
- [ ] saveStatus shows 'שומר...' during API call
- [ ] saveStatus shows 'שגיאת שמירה ✗' on API failure + optimistic update reverted
- [ ] No global Save button anywhere in the UI
- [ ] URL modal field has `dir="ltr"`
- [ ] Duplicate url_normalized within account → error shown in modal
- [ ] All operations logged in activity_log

### Tests to Run

1. Add root page → appears in tree
2. Add child page → hierarchy correct
3. Edit page name → tree updates + green indicator
4. Delete leaf page → removed
5. Delete page with children → warning + all removed
6. Simulate API failure → error indicator + tree reverts
7. Check activity_log in Supabase for each operation

---

## Phase 6: Page Status, Notes, and Move

### Goal
Status and notes display, drag-and-drop move.

### Files to Create

- `components/tree/DragDropProvider.tsx` — @hello-pangea/dnd
- `components/modals/MoveConfirmModal.tsx`

### API Endpoints

```
PATCH /api/pages/:id
  (Existing — handles parent_id + sort_order change)
  Side effect: log page_moved with from/to parent info
```

### Acceptance Criteria

- [ ] Status badge correct color for all 8 statuses
- [ ] Notes icon on pages with notes; tooltip on hover shows note text
- [ ] Notes editable in edit modal
- [ ] Drag over another page → drop zone highlights
- [ ] Drop → move confirm modal
- [ ] Confirm → page in new position, save fires
- [ ] Cancel → page returns to original position
- [ ] Re-order within same parent → no confirm, silent save

---

## Phase 7: Bulk Operations

### Goal
Multi-select and all 6 bulk actions.

### Files to Create

- `components/tree/BulkToolbar.tsx`
- `components/modals/BulkActionModal.tsx`
- Update `DeleteConfirmModal.tsx` for bulk with descendant count

### API Endpoints

```
POST /api/pages/bulk
  Auth: user session
  Body: BulkOperationPayload { action, page_ids, value?, append? }
  Logic:
    - delete: fetch all descendant IDs, delete all in transaction
    - move: update parent_id for all page_ids
    - change_status/template/color: update field for all page_ids
    - add_note: update notes (append or replace) for all page_ids
  Side effect: single bulk activity entry with { action, page_ids, count, affected_total }
  Response: { updated_count, pages }
```

### Acceptance Criteria

- [ ] Checkbox on hover next to each node
- [ ] Selecting opens bulk toolbar with count
- [ ] "Select All" selects all visible nodes
- [ ] Bulk delete modal shows: X selected, Y total affected (including descendants)
- [ ] Each bulk action opens correct modal
- [ ] After bulk op: selection cleared, one activity log entry
- [ ] saveStatus fires during/after

### Tests to Run

1. Select 3 pages → count shows "3 עמודים נבחרו"
2. Bulk status → all 3 changed
3. Bulk delete (with children) → modal shows correct Y total → all deleted
4. Check activity_log: single bulk entry, not one per page

---

## Phase 8: Presence System

### Goal
Show who is online per account.

### Files to Create

- `components/presence/PresenceBar.tsx` — shows first 5, then "+N עוד" link
- `components/presence/PresencePopover.tsx` — full list on click
- `stores/presenceStore.ts`

### API Endpoints

```
POST /api/presence/heartbeat
  Auth: user session (user_id from session, not body)
  Body: { account_id }
  Logic: UPSERT into presence table
  Response: { ok }

GET /api/presence?account_id=:id
  Auth: user session
  Logic: SELECT WHERE account_id = X AND last_seen > now() - 10min
  Response: PresenceUser[]

POST /api/presence/cleanup
  Auth: service role (cron target, protected by secret header or Vercel Cron)
  Logic: DELETE FROM presence WHERE last_seen < now() - 30 days
  Response: { deleted }
```

### Acceptance Criteria

- [ ] Current user appears in presence bar with green dot
- [ ] Second user in same account appears within 30 seconds
- [ ] Users in different accounts do NOT see each other
- [ ] Inactive user (2–10 min) shows yellow dot with "לא פעיל X דקות"
- [ ] User > 10 min inactive disappears
- [ ] When > 5 online: "+N עוד" appears → clicks opens popover with full list
- [ ] Switching accounts stops old heartbeat, starts new one

### Tests to Run

1. Login as A → green dot appears
2. Login as B (same account) → A sees B within 30s
3. Login as C (different account) → A does NOT see C
4. Stop B's tab → within 10 min, B disappears from A's presence

---

## Phase 9: Activity Feed

### Goal
Per-account event history with filters.

### Files to Create

- `app/app/activity/page.tsx`
- `components/activity/ActivityFeed.tsx`
- `components/activity/ActivityFilters.tsx`

### API Endpoints

```
GET /api/activity?account_id=:id&user_id=:id&action=:action&from=:date&to=:date&page=:n
  Auth: user session (RLS scopes to account)
  Response: { entries: ActivityEntry[], total, has_more }
  Pagination: 50 per page, newest first
```

### Acceptance Criteria

- [ ] Feed shows entries newest-first for current account
- [ ] Each entry: avatar initial, name, action text, relative timestamp
- [ ] Hover on timestamp → absolute datetime tooltip
- [ ] "Load more" loads next 50
- [ ] Filter by user, date range, action type all work
- [ ] Activity from Account A not visible in Account B
- [ ] All write operations from previous phases appear correctly

### Tests to Run

1. Perform 5 operations → confirm all 5 in feed
2. Filter by user → only that user's actions shown
3. Filter by action → only matching actions shown
4. Check cross-account isolation

---

## Phase 10: Snapshots

### Goal
Snapshot create, list, restore, compare, export, delete.

### Files to Create

- `app/app/snapshots/page.tsx`
- `components/snapshots/SnapshotList.tsx`
- `components/snapshots/SnapshotCard.tsx`
- `components/modals/SnapshotNameModal.tsx`
- `components/modals/SnapshotCompareModal.tsx`

### API Endpoints

```
GET  /api/snapshots?account_id=:id         → Snapshot[] (no data field)
POST /api/snapshots                        → Snapshot (create)
GET  /api/snapshots/:id                    → Snapshot (with data field)
DELETE /api/snapshots/:id                  → { ok }

POST /api/snapshots/:id/restore
  Logic (single transaction):
    1. Create auto-backup snapshot
    2. DELETE all pages WHERE account_id = X
    3. INSERT pages from snapshot.data (new IDs, preserved structure and url_normalized)
    4. Log activity: snapshot_restored
    5. COMMIT (rollback everything on any failure)
  Response: { ok, backup_snapshot_id }
```

### Compare Logic (client-side)

Match snapshot pages vs current pages by url_normalized (not by ID, since restore creates new IDs).
Classify each page: unchanged / changed (show diff fields) / deleted / added.

### Acceptance Criteria

- [ ] Create snapshot → appears in list with correct page count
- [ ] Delete snapshot → removed after confirmation
- [ ] Export → valid JSON downloads
- [ ] Restore → auto-backup created first → tree shows restored content
- [ ] Restore is fully transactional: if it fails, sitemap is unchanged
- [ ] Compare → two-column view with correct color coding
- [ ] Snapshots for Account A not visible in Account B

### Tests to Run

1. Create "Test 1" snapshot
2. Add a page → create "Test 2" snapshot
3. Delete the added page
4. Restore "Test 2" → page reappears → auto-backup created
5. Confirm failed restore (mock DB error) → sitemap unchanged
6. Compare "Test 1" with current → added page shown as yellow
7. Export "Test 1" → confirm valid JSON

---

## Phase 11: Enhanced GSC Import Engine

**Prerequisite:** Phases 0–10 must all be complete.

### Goal
Upload GSC data per account with URL normalization. Display click counts in tree. Show missing URLs with bulk-add support.

### Files to Create

- `app/admin/gsc/page.tsx`
- `components/admin/GscUpload.tsx`
- `app/app/missing-urls/page.tsx`
- `components/gsc/MissingUrlsTable.tsx`

### API Endpoints

```
POST /api/gsc
  Auth: admin only (service role for the delete+insert, user session for admin check)
  Body: FormData { account_id, file (CSV) }
  Logic:
    1. Parse CSV
    2. For each row: normalizeUrl(url_original, account.domain)
    3. BEGIN transaction
    4. DELETE FROM gsc_clicks WHERE account_id = X
    5. INSERT all new rows with url_original and url_normalized
    6. COMMIT
    7. Log activity: gsc_uploaded { file_name, record_count }
  Response: { inserted }

GET /api/gsc?account_id=:id
  Auth: user session
  Response: GscClick[]
```

### Matching Logic (client-side in treeStore)

```typescript
// After loading pages AND gsc_clicks:
// Build a Map<url_normalized, clicks>
// For each page: if page.url_normalized in the map → set page.gsc_clicks
// For Missing URLs tab: gsc rows whose url_normalized does NOT match any page.url_normalized
```

### Acceptance Criteria

- [ ] Admin uploads CSV → click counts appear in tree for matching pages
- [ ] GSC data for Account A does not affect Account B
- [ ] Missing URLs tab shows unmatched GSC URLs sorted by clicks DESC
- [ ] /about and /about/ are treated as the same URL
- [ ] https://colman.ac.il/about matches /about for account with domain colman.ac.il
- [ ] Single "Add Page" from missing URLs → pre-fills URL in modal
- [ ] Bulk add from missing URLs → batch creates pages
- [ ] After adding a page for a missing URL → that URL disappears from missing list
- [ ] GSC upload replaces old data (not appends)
- [ ] Upload logs gsc_uploaded activity

### Tests to Run

1. Upload CSV with 100 URLs → confirm 100 rows in gsc_clicks
2. Upload second CSV with 50 URLs → confirm only 50 rows remain (old deleted)
3. Upload CSV for Account A → check Account B has no new GSC data
4. Upload URL "/about/" → confirm page with url_normalized "/about" gets click count
5. View Missing URLs → confirm only unmatched URLs listed
6. Add page for missing URL → URL disappears from missing list

---

## Phase 12: Intelligent Sitemap Import Engine

**Prerequisite:** Phases 0–11 must all be complete.

### Goal
Full import pipeline: file upload → analysis → conflict resolution preview → transactional apply.

### Files to Create

- `components/modals/ImportModal.tsx`
- `components/modals/ImportPreviewModal.tsx`
- `lib/utils/importParser.ts` — parse xlsx/csv/json, detect columns
- `lib/utils/importEngine.ts` — hierarchy inference, conflict detection, ProposedPage generation

### API Endpoints

```
POST /api/import/analyze
  Auth: user session
  Body: FormData { account_id, file, prompt, import_mode, conflict_behavior? }
  Logic:
    1. Parse file (detect type from extension)
    2. Detect column structure
    3. Apply prompt guidance for interpretation
    4. Normalize all URLs via normalizeUrl(url, account.domain)
    5. Fetch existing pages for account (user session + RLS)
    6. Build Map<url_normalized, existing_page>
    7. For each parsed row: classify conflict_status
    8. Infer hierarchy from columns / URL depth / category groups
    9. Suggest hub pages where multiple children have no parent
    10. Store in import_jobs (status = ready_for_review)
    11. Return ImportAnalysisResult
  Response: ImportAnalysisResult

POST /api/import/apply
  Auth: user session
  Body: ImportApplyPayload { account_id, job_id, approvedProposedPages, import_mode, conflict_behavior }
  Logic (single transaction):
    1. Verify account access
    2. Fetch account.domain for url normalization
    3. Create auto-snapshot: "לפני ייבוא — {file_name} — {date}"
    4. If mode = create_new_sitemap: DELETE all pages WHERE account_id = X
    5. For each approved ProposedPage:
       - status = 'new': INSERT
       - status = 'existing_overwrite': UPDATE matched page (name, parent, template, status, color, notes)
       - status = 'existing_skip', 'duplicate', 'invalid': skip
    6. Update import_jobs: status = 'applied', applied_at = now()
    7. Log activity: import_applied { created, updated, skipped, file_name }
    8. COMMIT (rollback everything on failure)
  Response: ImportApplyResult { created, updated, skipped, invalid, backup_snapshot_id }
```

### Conflict Behavior Details

```
conflict_behavior = 'add_only':
  All ProposedPages where conflict_status = 'existing_overwrite' are reclassified to 'existing_skip'

conflict_behavior = 'overwrite_existing':
  ProposedPages where conflict_status = 'existing_overwrite' are applied as UPDATE
  Fields updated: name, parent_id, template, status, color, notes
  Fields NOT changed: id, created_by, created_at (all preserved)
```

### Acceptance Criteria

- [ ] Import modal shows file size limit (10MB) and row limit (20,000) in the upload zone
- [ ] File > 10MB → validation error shown, no import_job created, "נתח" button stays disabled
- [ ] File with > 20,000 rows → validation error shown after parse, no import_job created
- [ ] Import modal opens with file picker, prompt textarea, mode and conflict selectors
- [ ] .xlsx, .csv, .json all parse correctly
- [ ] After analysis: preview shows correct counts for new/overwrite/skip/duplicate/invalid
- [ ] Assumptions and warnings shown in preview
- [ ] Low-confidence proposals shown with 💡 indicator
- [ ] "Add New URLs Only" mode: no existing pages modified
- [ ] "Overwrite" mode: matched pages updated, IDs preserved, activity history preserved
- [ ] Apply creates auto-snapshot first
- [ ] Apply is transactional: failure leaves sitemap unchanged
- [ ] import_jobs record updated to 'applied' status
- [ ] Cancel updates import_jobs to 'cancelled', no sitemap change
- [ ] Activity log: import_applied with counts

### Tests to Run

1. Upload CSV with 10 new URLs → analyze → preview shows 10 green (new) → apply → 10 pages created
2. Upload CSV with 5 existing URLs (matching pages) + 5 new:
   - In add_only mode: 5 new created, 5 skipped (no existing changed)
   - In overwrite mode: 5 updated, 5 created
3. Upload CSV with duplicate URLs → duplicates shown in preview → not applied
4. Upload CSV with invalid URL → invalid shown in preview → not applied
5. Mock transaction failure during apply → confirm sitemap unchanged + import_jobs status = 'failed'
6. Cancel after analysis → no sitemap change + import_jobs status = 'cancelled'
7. Verify auto-snapshot created before every apply

---

## Phase 13: Admin Panel + Danger Zone

**Prerequisite:** Phases 0–12 must all be complete.

### Goal
Complete admin panel including account management, user management, and Clear Sitemap (Danger Zone).

### Files to Create

- `app/admin/layout.tsx` — system_admin guard
- `app/admin/page.tsx` — dashboard
- `app/admin/accounts/page.tsx`
- `app/admin/accounts/[id]/page.tsx`
- `app/admin/users/page.tsx`
- `components/admin/AccountList.tsx`
- `components/admin/AccountDetail.tsx`
- `components/admin/DangerZone.tsx`
- `components/modals/ClearSitemapModal.tsx` — two-step confirmation
- `components/admin/UserList.tsx`

### API Endpoints

```
POST /api/accounts
  Auth: system_admin (service role for INSERT)
  Body: { name, slug, domain }
  Response: Account

PATCH /api/accounts/:id
  Auth: system_admin
  Body: Partial<Account>
  Response: Account

DELETE /api/accounts/:id/sitemap
  Auth: system_admin (service role)
  Logic (single transaction):
    1. Fetch account (name, id)
    2. Count all pages for account
    3. INSERT snapshot (backup) with all pages
    4. DELETE all pages WHERE account_id = :id
    5. Log activity: sitemap_cleared { account_name, deleted_page_count, backup_snapshot_id, cleared_by }
    6. COMMIT
  Response: { deleted_page_count, backup_snapshot_id }

GET /api/admin/users          → Array<{ profile, accounts }>  (service role for cross-account query)
PATCH /api/admin/users/:id    → Profile (role change, service role)
POST /api/admin/users/:id/accounts    → UserAccount (admin assigns user)
DELETE /api/admin/users/:id/accounts/:account_id → { ok }
```

### Clear Sitemap UI Requirements

The `ClearSitemapModal` must implement exactly two confirmation steps:

Step 1 — Warning modal with "ביטול" | "המשך"
Step 2 — Second modal with text input. "מחק מפה" button is disabled until `input.toLowerCase() === account.name.toLowerCase()`.

### Acceptance Criteria

- [ ] /admin is inaccessible to non-admin users (middleware + layout guard)
- [ ] Admin can create new account → appears in account list
- [ ] Admin can archive account → disappears from regular users' account list
- [ ] Admin can assign user to account → user sees account in switcher after re-login
- [ ] Admin can remove user → user loses access
- [ ] Admin can change role to system_admin → that user can access /admin
- [ ] Danger Zone section visible in account detail page (admin only)
- [ ] Clear Sitemap: first confirmation shows warning text (Hebrew, as specified)
- [ ] Clear Sitemap: second confirmation requires exact account name typed
- [ ] "מחק מפה" button disabled until name matches
- [ ] Execution: auto-snapshot created first, all pages deleted, activity logged
- [ ] Execution is a single transaction: snapshot creation + page deletion + activity log all in one atomic operation
- [ ] If the transaction fails: sitemap unchanged, snapshot NOT created, activity NOT logged
- [ ] Non-admin users cannot see "Danger Zone" section or call DELETE /api/accounts/:id/sitemap

### Tests to Run

1. Login as non-admin → navigate to /admin → confirm redirect
2. Create account "Test Agency" → confirm appears in list
3. Assign user X to "Test Agency" → login as X → confirm "Test Agency" appears in switcher
4. Remove user X from "Test Agency" → login as X → confirm "Test Agency" gone
5. Open Danger Zone → click "מחק מפה" → first modal appears
6. Click "המשך" → second modal appears with input
7. Type wrong name → confirm button stays disabled
8. Type correct name (case-insensitive) → confirm button enables
9. Confirm → auto-snapshot created + pages deleted + activity logged
10. Mock DB failure during clear → confirm no partial deletion

---

## Phase 14: Polish and Edge Cases

### Goal
Fix rough edges, improve UX, verify all flows end-to-end.

### Checklist

- [ ] All Hebrew text correct (review all STATUS_LABELS, modal titles, button labels, errors)
- [ ] RTL layout correct in all components
- [ ] Loading skeletons for tree, snapshots, activity
- [ ] Toast notifications for all success actions
- [ ] Empty states for all tabs
- [ ] Keyboard navigation in modals (Tab, Enter, Escape)
- [ ] Color picker aria-labels on each swatch
- [ ] Status badges have aria-label
- [ ] Session expiry → redirect to /login with "פג תוקף החיבור"
- [ ] Tree search filters real-time, shows ancestors of matches
- [ ] Status filter above tree works (multi-select)
- [ ] Switching account while modal open → close modal first
- [ ] Page URLs in tree displayed with `dir="ltr"` (correct inside RTL layout)
- [ ] Presence popover "+N עוד" shows full list on click
- [ ] Presence cleanup cron route configured in vercel.json
- [ ] AI Suggestions button visible in toolbar but disabled with "בקרוב" tooltip
- [ ] Import preview low-confidence items show 💡 with reasoning tooltip
- [ ] Auto-generated snapshots (from restore/clear/import) marked with 🔒 icon in snapshot list

### Vercel Cron Config

```json
// vercel.json
{
  "crons": [{
    "path": "/api/presence/cleanup",
    "schedule": "0 2 * * *"
  }]
}
```

### Final End-to-End Tests

1. Regular user flow: login → select account → add 5 pages → edit 2 → delete 1 → bulk status change → create snapshot → restore snapshot → export JSON → import JSON (overwrite mode)
2. Admin flow: login → create account → assign user → upload GSC → view missing URLs → bulk add → clear sitemap → confirm auto-snapshot created
3. Import flow: upload xlsx → analyze → preview → apply (add_only) → confirm only new pages created → upload same file with overwrite mode → confirm existing pages updated
4. Presence flow: 2 users same account → both see each other → one inactive 2 min → yellow dot → 10+ min → disappears
5. RLS verification: using Supabase client with user A's JWT, directly query pages for an account not assigned to A → confirm 0 rows returned
6. Conflict test: attempt to create two pages with same URL in same account → confirm uniqueness error
