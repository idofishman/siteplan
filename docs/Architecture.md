# Architecture.md — Colman Site Structure Manager v2
**Version:** 2.1.1  
**Status:** Final  
**Date:** 2026-06-19  
**Audience:** Claude Code (implementation reference)

---

## 1. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 14.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| Database | Supabase (Postgres) | Latest |
| Auth | Supabase Auth | Latest |
| Realtime | Supabase Realtime | Latest |
| State | Zustand | 4.x |
| Deployment | Vercel | Latest |

No other state management libraries. No Redux. No React Query. Use Zustand + direct Supabase calls.

---

## 2. Security Model

### 2.1 RLS is the Source of Truth

Row Level Security (RLS) is the primary mechanism for account isolation. It enforces isolation at the database level regardless of application logic.

"RLS is the source of truth for account isolation. API access checks are additional validation, not a replacement for RLS."

### 2.2 Service Role Key — Restricted Usage

The Supabase service role key bypasses RLS. It must be used ONLY for:
- System admin operations: creating/archiving accounts, managing user roles, user-account assignments
- Supabase Auth admin API calls (e.g., listing all users from auth.admin)
- Trusted server-only maintenance (e.g., scheduled presence cleanup cron)
- Specific operations that structurally cannot work with user-scoped RLS (e.g., cross-account reads by system admin)

**All other authenticated routes must use the user's Supabase session.** When the user's session is used, RLS automatically applies the correct account isolation.

The service role key must never be sent to the client or included in any client-side bundle.

### 2.3 API-Level Access Checks

API routes perform an explicit account access check before operating:
- Check if user is system_admin → allow all accounts
- Else check user_accounts → allow only assigned accounts

This is defense-in-depth. Even if this check fails, RLS prevents unauthorized data access at the database level.

---

## 3. Project Directory Structure

```
/
├── app/
│   ├── layout.tsx                        # Root layout (dir="rtl", fonts, providers)
│   ├── page.tsx                          # Root: redirects based on auth + account state
│   ├── login/
│   │   ├── page.tsx                      # Login form
│   │   └── actions.ts                    # signInWithPassword server action
│   ├── select-account/
│   │   └── page.tsx                      # Account selector (multi-account users)
│   ├── app/
│   │   ├── layout.tsx                    # App shell: header, presence bar, account switcher
│   │   ├── page.tsx                      # Main sitemap view
│   │   ├── activity/
│   │   │   └── page.tsx                  # Activity feed
│   │   ├── snapshots/
│   │   │   └── page.tsx                  # Snapshot manager
│   │   └── missing-urls/
│   │       └── page.tsx                  # Missing URLs tab
│   ├── admin/
│   │   ├── layout.tsx                    # Admin layout (system_admin guard)
│   │   ├── page.tsx                      # Admin dashboard
│   │   ├── accounts/
│   │   │   ├── page.tsx                  # Account list
│   │   │   └── [id]/
│   │   │       └── page.tsx              # Account detail + Danger Zone
│   │   ├── users/
│   │   │   └── page.tsx                  # User list + role management
│   │   └── gsc/
│   │       └── page.tsx                  # GSC upload
│   └── api/
│       ├── pages/
│       │   ├── route.ts                  # GET list, POST create
│       │   ├── [id]/
│       │   │   └── route.ts              # PATCH update, DELETE single
│       │   └── bulk/
│       │       └── route.ts              # POST bulk operations
│       ├── snapshots/
│       │   ├── route.ts                  # GET list, POST create
│       │   └── [id]/
│       │       ├── route.ts              # GET single, DELETE
│       │       └── restore/
│       │           └── route.ts          # POST restore (transactional)
│       ├── activity/
│       │   └── route.ts                  # GET list with filters
│       ├── gsc/
│       │   └── route.ts                  # POST upload GSC CSV (admin only)
│       ├── presence/
│       │   └── heartbeat/
│       │       └── route.ts              # POST upsert heartbeat
│       ├── accounts/
│       │   ├── route.ts                  # GET list, POST create (admin only)
│       │   └── [id]/
│       │       ├── route.ts              # PATCH update, DELETE/archive (admin only)
│       │       └── sitemap/
│       │           └── route.ts          # DELETE clear sitemap (admin only, transactional)
│       ├── import/
│       │   ├── analyze/
│       │   │   └── route.ts              # POST analyze file, returns ProposedPage[]
│       │   └── apply/
│       │       └── route.ts              # POST apply approved proposals (transactional)
│       ├── presence/
│       │   └── cleanup/
│       │       └── route.ts              # POST delete presence rows > 30 days (cron target)
│       └── admin/
│           └── users/
│               ├── route.ts              # GET all users (admin only)
│               └── [id]/
│                   ├── route.ts          # PATCH role (admin only)
│                   └── accounts/
│                       └── route.ts      # GET/POST/DELETE user-account assignments
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── AuthProvider.tsx
│   ├── account/
│   │   ├── AccountSwitcher.tsx
│   │   └── AccountSelector.tsx
│   ├── presence/
│   │   ├── PresenceBar.tsx
│   │   └── PresencePopover.tsx           # Full list when > 5 users online
│   ├── tree/
│   │   ├── PageTree.tsx
│   │   ├── PageNode.tsx
│   │   ├── PageNodeMenu.tsx
│   │   ├── BulkToolbar.tsx
│   │   └── DragDropProvider.tsx
│   ├── modals/
│   │   ├── AddEditPageModal.tsx
│   │   ├── DeleteConfirmModal.tsx
│   │   ├── BulkActionModal.tsx
│   │   ├── MoveConfirmModal.tsx
│   │   ├── SnapshotNameModal.tsx
│   │   ├── SnapshotCompareModal.tsx
│   │   ├── ImportModal.tsx               # File upload + prompt + mode + conflict selector
│   │   ├── ImportPreviewModal.tsx        # Shows proposed pages before applying
│   │   └── ClearSitemapModal.tsx         # Two-step admin danger zone confirmation
│   ├── activity/
│   │   ├── ActivityFeed.tsx
│   │   └── ActivityFilters.tsx
│   ├── snapshots/
│   │   ├── SnapshotList.tsx
│   │   └── SnapshotCard.tsx
│   ├── gsc/
│   │   └── MissingUrlsTable.tsx
│   ├── admin/
│   │   ├── AccountList.tsx
│   │   ├── AccountDetail.tsx
│   │   ├── DangerZone.tsx                # Clear Sitemap UI (admin only)
│   │   ├── UserList.tsx
│   │   └── GscUpload.tsx
│   └── ui/
│       ├── SaveIndicator.tsx
│       ├── StatusBadge.tsx
│       ├── ColorSwatch.tsx
│       ├── TemplateSelect.tsx
│       ├── Avatar.tsx
│       ├── EmptyState.tsx
│       └── Toast.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # createBrowserClient (for client components)
│   │   └── server.ts                     # createServerClient (for API routes + server components)
│   ├── utils/
│   │   ├── tree.ts                       # flatTree, buildTree, findNode, getDescendantIds
│   │   ├── url.ts                        # normalizeUrl() — shared, reusable
│   │   ├── activity.ts                   # logActivity() helper
│   │   └── cn.ts                         # clsx/twMerge
│   └── constants.ts                      # COLORS, TEMPLATES, STATUS_LABELS, STATUS_COLORS
├── stores/
│   ├── accountStore.ts
│   ├── treeStore.ts
│   ├── uiStore.ts
│   └── presenceStore.ts
├── types/
│   └── index.ts                          # All TypeScript interfaces
├── middleware.ts
└── public/
```

---

## 4. TypeScript Types

```typescript
// types/index.ts

export type UserRole = 'system_admin' | 'user';

export type PageStatus =
  | 'planned'
  | 'existing'
  | 'in_progress'
  | 'needs_review'
  | 'approved'
  | 'deprecated'
  | 'redirect'
  | 'archived';

export type ImportMode = 'analyze_only' | 'merge_into_existing' | 'create_new_sitemap';
export type ImportConflictBehavior = 'add_only' | 'overwrite_existing';
export type ImportJobStatus = 'analyzing' | 'ready_for_review' | 'applied' | 'failed' | 'cancelled';

export type ConflictStatus = 'new' | 'existing_overwrite' | 'existing_skip' | 'duplicate' | 'invalid';

export interface Account {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

export interface Profile {
  id: string;
  display_name: string;
  role: UserRole;
  created_at: string;
}

export interface UserAccount {
  user_id: string;
  account_id: string;
  assigned_at: string;
}

export interface Page {
  id: string;
  account_id: string;
  parent_id: string | null;
  name: string;
  url: string | null;
  url_normalized: string | null;
  color: string | null;
  template: string | null;
  status: PageStatus;
  notes: string | null;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed client-side, not stored
  gsc_clicks?: number;
}

export interface PageNode extends Page {
  children: PageNode[];
}

export interface ActivityEntry {
  id: string;
  account_id: string;
  user_id: string | null;
  user_name: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface Snapshot {
  id: string;
  account_id: string;
  name: string;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  page_count: number;
  data: Page[];   // only populated in GET /api/snapshots/:id, not in list
}

export interface PresenceUser {
  user_id: string;
  account_id: string;
  display_name: string;
  last_seen: string;
  status: 'active' | 'inactive';   // computed: active < 2min, inactive 2-10min
}

export interface GscClick {
  id: string;
  account_id: string;
  url_original: string;
  url_normalized: string;
  clicks: number;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  uploaded_at: string;
}

// Bulk operation types
export type BulkAction =
  | 'delete'
  | 'move'
  | 'change_status'
  | 'change_template'
  | 'change_color'
  | 'add_note';

export interface BulkOperationPayload {
  action: BulkAction;
  page_ids: string[];
  value?: string;
  append?: boolean;   // for add_note: append vs replace
}

// Import types
export interface ProposedPage {
  temp_id: string;
  parent_temp_id: string | null;
  matched_existing_page_id?: string | null;
  conflict_status: ConflictStatus;
  name: string;
  url: string | null;
  url_normalized: string | null;
  template: string | null;
  status: PageStatus;
  color: string | null;
  notes: string | null;
  confidence: number;         // 0.0–1.0
  source_row?: number;
  reasoning?: string;
}

export interface ImportAnalysisResult {
  job_id: string;
  summary: {
    new_count: number;
    overwrite_count: number;
    skip_count: number;
    duplicate_count: number;
    invalid_count: number;
    suggested_hub_count: number;
  };
  proposedPages: ProposedPage[];
  warnings: string[];
  assumptions: string[];
  duplicateUrls: string[];
  invalidRows: Array<{ row: number; reason: string }>;
}

export interface ImportApplyPayload {
  account_id: string;
  job_id: string;
  approvedProposedPages: ProposedPage[];
  import_mode: ImportMode;
  conflict_behavior: ImportConflictBehavior;
}

export interface ImportApplyResult {
  created: number;
  updated: number;
  skipped: number;
  invalid: number;
  backup_snapshot_id: string;
}
```

---

## 5. URL Normalization Utility

This is a single shared function used everywhere URLs are compared:
- GSC upload (normalizing incoming URLs)
- Sitemap pages (normalizing page URLs on save)
- Import engine (matching imported URLs against existing pages)
- Missing URLs tab (matching GSC URLs against sitemap URLs)

```typescript
// lib/utils/url.ts

/**
 * Normalize a URL for consistent comparison.
 * @param rawUrl - Raw URL from any source
 * @param accountDomain - Account domain for converting absolute to relative (e.g., 'colman.ac.il')
 * @returns Normalized relative URL string, or null if invalid
 */
export function normalizeUrl(rawUrl: string | null | undefined, accountDomain?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let url = rawUrl.trim().toLowerCase();

  // Convert absolute URL to relative if domain matches account domain
  if (accountDomain) {
    const domain = accountDomain.toLowerCase();
    const prefixes = [
      `https://${domain}`,
      `http://${domain}`,
      `https://www.${domain}`,
      `http://www.${domain}`,
    ];
    for (const prefix of prefixes) {
      if (url.startsWith(prefix)) {
        url = url.slice(prefix.length) || '/';
        break;
      }
    }
  }

  // Remove query string and hash
  url = url.split('?')[0].split('#')[0];

  // Ensure starts with /
  if (!url.startsWith('/')) {
    url = '/' + url;
  }

  // Remove trailing slash (except root)
  if (url.length > 1 && url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  // Basic validity check: must contain only path-safe characters
  if (!/^\/[a-z0-9\-._~:@!$&'()*+,;=%/]*$/.test(url)) {
    return null;
  }

  return url;
}
```

---

## 6. Zustand Stores

### 6.1 accountStore

```typescript
interface AccountStore {
  accounts: Account[];
  activeAccount: Account | null;
  setActiveAccount: (account: Account) => void;
  loadAccounts: () => Promise<void>;
}
```

### 6.2 treeStore

```typescript
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface TreeStore {
  pages: Page[];
  tree: PageNode[];         // derived from pages via buildTree()
  saveStatus: SaveStatus;
  gscClicks: Record<string, number>;   // url_normalized -> clicks

  loadPages: (accountId: string) => Promise<void>;
  loadGsc: (accountId: string) => Promise<void>;

  addPage: (data: Partial<Page>) => Promise<void>;
  updatePage: (id: string, data: Partial<Page>) => Promise<void>;
  deletePage: (id: string) => Promise<void>;
  movePage: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;

  bulkOperation: (payload: BulkOperationPayload) => Promise<void>;
  importApply: (payload: ImportApplyPayload) => Promise<ImportApplyResult>;

  handleRemotePageChange: (event: 'INSERT' | 'UPDATE' | 'DELETE', page: Page) => void;
}
```

### 6.3 uiStore

```typescript
interface UiStore {
  selectedPageIds: Set<string>;
  expandedNodeIds: Set<string>;
  activeModal: string | null;
  modalPayload: unknown;

  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  toggleExpand: (id: string) => void;

  openModal: (name: string, payload?: unknown) => void;
  closeModal: () => void;
}
```

### 6.4 presenceStore

```typescript
interface PresenceStore {
  users: PresenceUser[];
  startHeartbeat: (accountId: string, displayName: string) => void;
  stopHeartbeat: () => void;
  setUsers: (users: PresenceUser[]) => void;
}
```

---

## 7. Middleware

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  // 1. Create Supabase server client using user's session cookies
  // 2. Get session
  // 3. No session + path starts with /app or /admin → redirect to /login
  // 4. Session exists + path starts with /admin → check profile.role = 'system_admin'
  //    Not admin → redirect to /app
  // 5. Otherwise allow
}

export const config = {
  matcher: ['/app/:path*', '/admin/:path*'],
}
```

---

## 8. API Route Conventions

### 8.1 Authentication

Every API route must:
1. Create a Supabase client using the user's session (not service role, unless explicitly required — see §2.2)
2. Call `supabase.auth.getUser()` to verify the session
3. Return 401 if no valid session

```typescript
// Standard auth check in API routes
const supabase = createServerClient(...)   // uses user session cookies
const { data: { user } } = await supabase.auth.getUser()
if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
```

### 8.2 Account Access

Every API route that operates on account-scoped data must verify access:

```typescript
// lib/utils/auth.ts
export async function verifyAccountAccess(
  supabase: SupabaseClient,
  userId: string,
  accountId: string
): Promise<boolean> {
  // Check system_admin first
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'system_admin') return true

  // Check user_accounts
  const { data: assignment } = await supabase
    .from('user_accounts').select('user_id')
    .eq('user_id', userId).eq('account_id', accountId).single()
  return !!assignment
}
```

### 8.3 Admin-Only Routes

Admin-only API routes (user management, GSC upload, clear sitemap, create/archive accounts):

```typescript
const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
if (profile?.role !== 'system_admin') return Response.json({ error: 'Forbidden' }, { status: 403 })
```

For admin operations that require bypassing RLS (e.g., reading all users), create a separate Supabase client using the service role:

```typescript
const adminSupabase = createServiceRoleClient()  // uses SUPABASE_SERVICE_ROLE_KEY
```

---

## 9. Complete API Routes Reference

### Pages

```
GET  /api/pages?account_id=:id               → Page[]
POST /api/pages                              → Page         (create)
PATCH /api/pages/:id                         → Page         (update)
DELETE /api/pages/:id                        → { deleted_count }
POST /api/pages/bulk                         → { updated_count, pages }
```

### Snapshots

```
GET  /api/snapshots?account_id=:id           → Snapshot[]  (without data field)
POST /api/snapshots                          → Snapshot     (create)
GET  /api/snapshots/:id                      → Snapshot     (with data field)
DELETE /api/snapshots/:id                    → { ok }
POST /api/snapshots/:id/restore              → { ok }       (transactional)
```

### Activity

```
GET /api/activity?account_id=:id&user_id=&action=&from=&to=&page=  → { entries, total, has_more }
```

### GSC

```
POST /api/gsc                                → { inserted }  (admin only, replaces account GSC)
GET  /api/gsc?account_id=:id                 → GscClick[]
```

### Accounts

```
GET  /api/accounts                           → Account[]
POST /api/accounts                           → Account       (admin only)
PATCH /api/accounts/:id                      → Account       (admin only)
DELETE /api/accounts/:id/sitemap             → { deleted_page_count, backup_snapshot_id }  (admin only, transactional)
```

### Import

```
POST /api/import/analyze                     → ImportAnalysisResult
POST /api/import/apply                       → ImportApplyResult     (transactional)
```

### Admin

```
GET  /api/admin/users                        → Array<{ profile, accounts }>  (admin only)
PATCH /api/admin/users/:id                   → Profile                       (admin only)
GET  /api/admin/users/:id/accounts           → Account[]
POST /api/admin/users/:id/accounts           → UserAccount                   (admin only)
DELETE /api/admin/users/:id/accounts/:account_id → { ok }                    (admin only)
```

### Presence

```
POST /api/presence/heartbeat                 → { ok }
POST /api/presence/cleanup                   → { deleted }  (cron target, admin/service only)
```

---

## 10. Clear Sitemap API (Transactional)

```
DELETE /api/accounts/:id/sitemap
```

Logic (must run in a single Postgres transaction):
1. Verify caller is system_admin (use service role for this check)
2. Fetch account name and current page count
3. INSERT snapshot with all current pages (backup)
4. DELETE all pages WHERE account_id = :id
5. INSERT activity_log entry: sitemap_cleared with { account_id, account_name, deleted_page_count, backup_snapshot_id, cleared_by }
6. COMMIT
7. Return: { deleted_page_count, backup_snapshot_id }

If any step fails, rollback the entire transaction.

---

## 11. Import Analyze API

```
POST /api/import/analyze
Body: FormData { account_id, file, prompt, import_mode }
```

Logic:
0. **Enforce performance limits before any processing:**
   - File size > 10 MB → return 400 with validation error, do not create import_jobs row
   - Row count > 20,000 (checked after initial parse) → same
   - Proposed pages > 10,000 (checked after analysis) → same
1. Parse uploaded file (xlsx/csv/json)
2. Detect column structure
3. Use prompt to guide interpretation
4. Normalize all URLs using normalizeUrl()
5. Match against existing pages in account (fetch existing pages from DB, compare url_normalized)
6. Generate ProposedPage[] with conflict_status for each
7. Save to import_jobs table with status = 'ready_for_review'
8. Return ImportAnalysisResult (includes job_id)

This route must use the user's Supabase session (not service role) since it reads pages that RLS already scopes to the account.

---

## 12. Import Apply API (Transactional)

```
POST /api/import/apply
Body: ImportApplyPayload
```

Logic (single transaction):
1. Verify user has access to account
2. Create automatic snapshot: "לפני ייבוא — {file_name} — {date}"
3. If mode = 'create_new_sitemap': DELETE all current pages
4. For each approved ProposedPage:
   - If conflict_status = 'new': INSERT new page
   - If conflict_status = 'existing_overwrite': UPDATE existing page (by matched_existing_page_id)
   - If conflict_status = 'existing_skip': skip
   - If conflict_status = 'duplicate' or 'invalid': skip
5. Update import_jobs record: status = 'applied', applied_at = now()
6. Log activity: import_applied with { created, updated, skipped, file_name }
7. COMMIT
8. Return ImportApplyResult

If any step fails, rollback everything. Return error. Do not leave sitemap in partial state.

---

## 13. Realtime Subscription

```typescript
// In treeStore or useAccountRealtime(accountId) hook

const channel = supabase
  .channel(`account-${accountId}`)
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'pages', filter: `account_id=eq.${accountId}` },
    (payload) => treeStore.handleRemotePageChange(payload.eventType, payload.new || payload.old)
  )
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'presence', filter: `account_id=eq.${accountId}` },
    () => presenceStore.refreshPresence(accountId)
  )
  .subscribe()

return () => supabase.removeChannel(channel)
```

---

## 14. Auto-Save Flow

Every tree mutation follows this pattern:

```
User action
  → Optimistic update in treeStore (update local state immediately)
  → Set saveStatus = 'saving'
  → Call API route
    → API uses user's Supabase session (RLS applies)
    → API saves to DB
    → API calls logActivity()
    → Returns 200
  → Set saveStatus = 'saved' (fades after 3s)
  → On error: revert optimistic update, set saveStatus = 'error'
```

There is no global Save button. Modal "Save" buttons are submit triggers that immediately write to the database.

---

## 15. Presence Flow

```
App mounts with accountId
  → presenceStore.startHeartbeat(accountId, displayName)
    → POST /api/presence/heartbeat (uses user session)
    → setInterval(30000) → repeat every 30s
  → Subscribe to Realtime presence table changes for accountId
    → On change: re-query presence WHERE account_id = accountId AND last_seen > now() - 10min
    → Compute 'active' or 'inactive' from last_seen
  → On account switch: stopHeartbeat(), start new for new accountId
  → On logout: DELETE own presence row, stopHeartbeat()

Presence cleanup (cron):
  → POST /api/presence/cleanup (called by Vercel Cron, service role)
  → DELETE FROM presence WHERE last_seen < now() - 30 days
```

---

## 16. Tree Utilities

```typescript
// lib/utils/tree.ts

export function buildTree(pages: Page[]): PageNode[]
export function flatTree(nodes: PageNode[]): PageNode[]
export function findNode(tree: PageNode[], id: string): PageNode | null
export function getDescendantIds(tree: PageNode[], id: string): string[]

// Get total affected count for bulk delete (selected + all their descendants)
export function getAffectedDeleteCount(tree: PageNode[], selectedIds: string[]): number
```

---

## 17. Concurrent Editing and Account Deactivation

### 17.1 Concurrent Editing Policy

**Last Write Wins** is the intentional concurrency model for v2.1.

- No optimistic locking, no page checkout, no version vectors
- Multiple users can edit the same page simultaneously; the last successful DB write wins
- Realtime subscriptions propagate the winning state to all connected clients within ~1 second
- The client applies Realtime updates as they arrive — no manual refresh needed
- No merge conflict UI is required or implemented

This is a deliberate product decision. Revisit only if concurrent-edit conflicts become a recurring user complaint.

### 17.2 Account Deactivation

When `accounts.is_active = false`:

- RLS `user_assigned_accounts` policy excludes the account from all regular user queries (`is_active = true` filter)
- API routes must additionally check `is_active` before processing requests from non-admin users (defense-in-depth)
- System admins bypass both — they access all accounts regardless of `is_active`
- Account data is never deleted on deactivation
- Middleware must treat 403 from account APIs the same as "account not found" for security (don't reveal whether account exists)

---

## 18b. RTL Configuration

```typescript
// app/layout.tsx
<html lang="he" dir="rtl">
```

Use Tailwind logical properties (start/end) instead of left/right where possible. Page URLs in the tree use `dir="ltr"` to render correctly within the RTL layout.

---

## 18. AI Sitemap Assistant — Architecture Stub

Not implemented in v2. Architecture defined for future use:

```typescript
// app/api/ai/suggest/route.ts (stub)
// POST { account_id, pages: PageNode[] }
// → AiSuggestion[]
// Calls LLM via server-side API (Anthropic or OpenAI)
// Never automatic — only on explicit user request

interface AiSuggestion {
  type: 'orphan' | 'duplicate' | 'suggest_hub' | 'content_cluster' | 'linking' | 'gap';
  title: string;
  description: string;
  affected_page_ids: string[];
  proposed_changes?: Partial<Page>[];
}
```

"AI Suggestions" button in toolbar: disabled in v2, visible with "בקרוב" tooltip.

---

## 19. Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 20. Technical Debt to Avoid (Lessons from v1)

| v1 Problem | v2 Solution |
|---|---|
| localStorage as primary DB | Supabase Postgres only |
| File truncation (single HTML) | Proper multi-file project |
| No accounts concept | Fully multi-tenant with RLS |
| Manual save button | Auto-save on every action |
| Silent error swallowing | Explicit error states + UI feedback |
| Hardcoded GSC data in HTML | gsc_clicks table per account |
| No URL normalization | Shared normalizeUrl() function used everywhere |
| No activity log | activity_log table |
| No snapshots | snapshots table (JSONB, revisit if scale increases) |
| No page status | page_status enum |
| No notes per page | notes column |
| No bulk operations | Bulk API route |
| No presence | presence table + Realtime |
| Service role used everywhere | Service role only for admin operations |
| No import intelligence | Import engine with analysis + conflict resolution |
| No safe destructive actions | Double confirmation + transactional + auto-snapshot |
