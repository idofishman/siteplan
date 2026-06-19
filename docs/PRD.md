# PRD — Colman Site Structure Manager v2
**Version:** 2.1.1  
**Status:** Final  
**Date:** 2026-06-19  
**Audience:** Claude Code (implementation reference)

---

## 1. Product Overview

The Colman Site Structure Manager is a multi-account web application for managing hierarchical website sitemaps. It allows digital teams to build, edit, and organize page trees, track changes, manage GSC traffic data, import sitemap data intelligently, and collaborate in real time across multiple client accounts.

### 1.1 Problem Statement

Digital agencies and university web teams manage multiple website structures simultaneously. Each site has its own hierarchy, traffic data, change history, and team. The tool must support complete isolation between accounts while allowing a system administrator to manage all accounts from a single interface.

### 1.2 Platform

- Web-only (desktop-first, Hebrew RTL)
- Deployed on Vercel
- Backend via Supabase (Postgres + Auth + Realtime + RLS)
- No mobile optimization required in v2

---

## 2. Account Architecture

### 2.1 What Is an Account

An Account represents a single client or website. Each Account contains:
- Its own sitemap (page tree)
- Its own GSC click data
- Its own activity log
- Its own version snapshots
- Its own set of assigned users

Accounts are completely isolated. No data is shared between accounts at any level.

### 2.2 Account Fields

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| name | text | Display name (e.g., "Colman", "White Web Worx") |
| slug | text | URL-safe identifier (e.g., "colman", "white-web-worx") |
| domain | text | Primary domain used for URL normalization (e.g., "colman.ac.il") |
| is_active | boolean | Active = accessible; false = archived |
| created_at | timestamptz | Creation date |
| created_by | uuid | System admin who created it |

### 2.2 Account Deactivation Behavior

When `is_active = false`:

- The account is **hidden from all regular users** — not visible in the account selector or switcher, not accessible via any API endpoint
- **Data is preserved** — all pages, snapshots, activity_log, gsc_clicks, user_accounts rows remain intact
- **System admins** can still access and manage inactive accounts via the admin panel
- The admin panel shows inactive accounts with an "ארכיון" badge
- **Reactivation** is possible at any time by setting `is_active = true` — all data immediately becomes accessible again
- User-account assignments are preserved across deactivation/reactivation cycles

### 2.3 Account Examples

- Colman (colman.ac.il)
- White Web Worx (whiteweb.co.il)
- Client A
- Client B

---

## 3. User Types

The system has exactly two user types.

### 3.1 System Admin

- Has full access to ALL accounts without being assigned
- Can create new accounts
- Can archive accounts
- Can assign users to accounts
- Can manage user permissions
- Can upload GSC files for any account
- Can restore snapshots for any account
- Can clear a sitemap (destructive action — see §19)
- Can view all activity across all accounts
- Is identified by role = 'system_admin' in the profiles table
- There can be multiple system admins
- The first system admin is seeded manually after deployment

### 3.2 User

- Has access ONLY to accounts explicitly assigned via the user_accounts table
- Cannot see any account not assigned to them
- Cannot see that other accounts exist
- Cannot access admin panel
- Cannot create accounts
- Cannot manage other users
- Cannot clear a sitemap
- A user can be assigned to multiple accounts
- A user with zero assignments sees an empty state with no accounts available

### 3.3 Role Storage

Role is stored in profiles.role. Values: 'system_admin' | 'user'. Default is 'user'.

---

## 4. Authentication

### 4.1 Login Method

Email/password via Supabase Auth. Magic link is NOT used. No social login.

### 4.2 Login Flow

1. User navigates to /login
2. Enters email + password
3. On success → redirect to /
4. If user has 1 account → auto-select that account → load app
5. If user has more than 1 account → show Account Selector screen
6. If user is System Admin → show all accounts with option to create new

### 4.3 Session Handling

- Sessions persist across browser closes (Supabase default)
- On session expiry → redirect to /login with message "פג תוקף החיבור"
- No anonymous access

---

## 5. Account Switcher

### 5.1 Behavior

- Only visible if user has more than 1 assigned account (or is system admin)
- Displayed in the header as a dropdown: Account: [ Colman ]
- Switching account loads: sitemap, activity, GSC data, snapshots, presence for the new account
- Previous account data is cleared from memory (not deleted)
- Current account is stored in localStorage as sitemap_active_account
- On login, if stored account is valid → auto-select it

### 5.2 Account Selector Sorting

The account selector (full-screen card view) sorts accounts in this order:
1. Last used account first (determined by sitemap_active_account in localStorage)
2. Then alphabetical by account name

### 5.3 System Admin Account Switcher

- Shows all accounts (active only by default)
- Toggle to show archived accounts
- Shows user count per account

---

## 6. Presence System

### 6.1 Purpose

Users must see who else is currently active in the same account.

### 6.2 Display

Header shows a presence bar. Shows first 5 users. If more are online, shows "+N עוד" clickable link that opens a popover listing all online users.

Example:
  Dana (green)   Yossi (green)   Ran (yellow - לא פעיל 2 דקות)   +3 עוד

### 6.3 Rules

- Presence is per-account (users in different accounts are not shown to each other)
- Presence updates every 30 seconds via Supabase Realtime
- A user is considered "active" if their last heartbeat was within 2 minutes
- A user is considered "inactive" (shown in yellow) if their last heartbeat was 2–10 minutes ago
- A user is removed from presence display if their last heartbeat was more than 10 minutes ago
- Presence is stored in the presence table
- Heartbeat is sent via setInterval every 30 seconds while the app is open
- On tab close no explicit cleanup is needed; stale records are ignored based on timestamp
- Scheduled cleanup deletes presence rows older than 30 days (Supabase cron or server job)

### 6.4 Presence Fields

user_id, account_id, last_seen (timestamptz), display_name

---

## 7. Auto Save

### 7.1 Behavior

Every action that modifies the sitemap triggers an immediate save to Supabase. There is no global manual Save button.

Actions that trigger auto-save:
- Add page
- Edit page (name, URL, color, template, status, notes)
- Delete page
- Move page (drag-drop or keyboard)
- Import (apply)
- Bulk operations (delete, move, status change, template change, color change, add note)

### 7.2 Modal Save Buttons

Modals have a "שמור" (Save) button. This button means "submit this modal and immediately auto-save to the database." It is not a global save button. The distinction:
- No global Save button exists anywhere in the app
- Modal "Save" buttons are submit triggers that write to the database immediately

### 7.3 Save Indicator

The header shows a save state indicator:
- "Saving..." — write in progress
- "Saved ✓" — last write succeeded (fades after 3 seconds)
- "Save Failed ✗" — write failed (stays visible, retries on next action)

### 7.4 Concurrent Editing Policy (Last Write Wins)

v2.1 uses **Last Write Wins** as its intentional concurrency model. This is a deliberate product decision, not a gap.

- No optimistic locking, no page checkout, no merge conflict resolution
- If two users edit the same page simultaneously, the last successful database write wins
- Realtime subscriptions propagate the final state to all users within ~1 second, providing practical visibility into concurrent changes
- This model is appropriate for expected team sizes and usage patterns; revisit if conflicts become a frequent complaint

### 7.5 No localStorage for Data

The page tree is NOT stored in localStorage. localStorage is only used for:
- sitemap_active_account — last selected account ID
- sitemap_expanded_nodes — which tree nodes are expanded (UI state only)

---

## 8. Page Tree

### 8.1 Structure

Pages are organized in a hierarchical tree. Each page can have children (unlimited depth). A page without a parent is a root node.

### 8.2 Page Fields

| Field | Type | Required | Description |
|---|---|---|---|
| id | uuid | Yes | Primary key |
| account_id | uuid | Yes | Account this page belongs to |
| parent_id | uuid | No | Parent page (null = root) |
| name | text | Yes | Page display name |
| url | text | No | Relative URL (e.g., /admissions/) |
| url_normalized | text | No | Normalized version of URL (see §14.3) |
| color | text | No | Hex code from the 16-color palette |
| template | text | No | One of 22 template types |
| status | text | Yes | One of 8 statuses (see §9) |
| notes | text | No | Free-text notes |
| sort_order | integer | Yes | Position among siblings |
| created_by | uuid | Yes | User who created the page |
| updated_by | uuid | Yes | User who last edited the page |
| created_at | timestamptz | Yes | Auto |
| updated_at | timestamptz | Yes | Auto |

No two pages in the same account may have the same url_normalized (when url_normalized is not null). This is enforced by a partial unique index.

### 8.3 Color Palette (16 colors)

```
#3B82F6 #10B981 #F59E0B #EF4444 #8B5CF6
#EC4899 #06B6D4 #84CC16 #F97316 #6366F1
#14B8A6 #F43F5E #A855F7 #0EA5E9 #22C55E
#64748B
```

### 8.4 Templates (22 types)

```
page | hub | homepage | faculty | department | degree
blog | blog-post | course | staff | staff-directory
research | research-center | research-network
registration | campus | student-life | portal
event | form | archive | gallery
```

### 8.5 Tree Operations

- Add page (child of selected, or root)
- Edit page fields
- Delete page (cascade to children, user confirms)
- Move page (drag-and-drop, confirm dialog for non-trivial moves)
- Expand / collapse node
- Search / filter tree

---

## 9. Page Status

### 9.1 Status Values

| Status | Hebrew | Meaning |
|---|---|---|
| planned | מתוכנן | Page is planned but not yet built |
| existing | קיים | Page is live on the current site |
| in_progress | בעבודה | Page is being worked on |
| needs_review | ממתין לאישור | Page requires review |
| approved | מאושר | Page has been approved |
| deprecated | מיושן | Page is obsolete |
| redirect | ריידיירקט | Page will redirect elsewhere |
| archived | בארכיון | Page is removed from active view |

### 9.2 Status Display

- Status shown as a colored badge next to the page name in the tree
- Each status has a distinct color (defined in UI-Spec.md)
- Status is filterable in the tree view

### 9.3 Default Status

When a new page is created, default status is 'existing'.

---

## 10. Page Notes

- Each page has a free-text notes field
- Notes are shown in the edit modal
- Notes are shown as a tooltip on hover in the tree (if note exists)
- Notes icon appears on pages that have notes
- Notes have no character limit

---

## 11. Bulk Operations

### 11.1 Selection

- Checkbox appears on hover next to each page in the tree
- "Select All" checkbox in the tree header
- Multi-select is maintained across expand/collapse
- Selected count shown in bulk action toolbar

### 11.2 Available Bulk Actions

| Action | Description |
|---|---|
| Delete | Delete all selected pages and their children |
| Move | Move all selected pages to a chosen parent |
| Change Status | Set status for all selected pages |
| Change Template | Set template for all selected pages |
| Change Color | Set color for all selected pages |
| Add Note | Append or replace note for all selected pages |

### 11.3 Confirmation

All bulk operations require a confirmation dialog. For bulk delete specifically:
- Before confirming, calculate: affected_count = selected pages + ALL descendants of selected pages
- Show in the confirmation modal: "X עמודים נבחרו. סה"כ Y עמודים יימחקו (כולל עמודים בנים)"
- This gives the user full visibility into the total impact before committing

---

## 12. Activity Feed

### 12.1 Purpose

Account-level log of all significant events. Every user can view the feed.

### 12.2 Events Logged

- page_created: page name, creator
- page_edited: field changed, old → new value, editor
- page_deleted: page name, deleter
- page_moved: from → to, mover
- status_changed: old → new
- bulk_delete, bulk_move, bulk_status, bulk_template, bulk_color, bulk_note
- gsc_uploaded: filename, record count, uploader
- json_imported: page count, importer
- json_exported: exporter
- snapshot_created: name, creator
- snapshot_restored: name, restorer
- snapshot_deleted: name, deleter
- user_added: admin action
- user_removed: admin action
- import_analyzed: file name, mode, result summary
- import_applied: created, updated, skipped counts
- import_cancelled: file name
- sitemap_cleared: account name, deleted_page_count, backup_snapshot_id, cleared_by

### 12.3 Activity Log Retention

Keep activity log indefinitely for v2. Revisit archive/export policy after 24 months or if table growth becomes a performance concern.

### 12.4 Filters

- By user (dropdown of account members)
- By date range (from / to)
- By action type (multi-select)

### 12.5 Display

- Reverse chronological (newest first)
- Paginated (50 per page)
- Each entry: avatar initial + name, action text, timestamp (relative + absolute on hover)

---

## 13. Version Snapshots

### 13.1 Purpose

Immutable named copies of the entire sitemap at a point in time.

### 13.2 Creating a Snapshot

- User clicks "Create Snapshot" button
- Enters a name (required, max 100 chars)
- System saves a deep copy of the current tree
- Snapshot is immutable once created

### 13.3 Snapshot Actions

| Action | Description |
|---|---|
| Restore | Replace current sitemap with snapshot contents (transactional) |
| Compare | Show diff between snapshot and current (added/removed/changed pages) |
| Export | Download snapshot as JSON |
| Delete | Remove snapshot (confirmation required) |

### 13.4 Snapshot Fields

id, account_id, name, created_by, created_at, data (jsonb — full tree)

Storing full tree as JSONB is acceptable for v2, given expected sitemap sizes (hundreds to low thousands of pages per account). Revisit snapshot storage strategy if account count, page count, or snapshot count grows significantly.

### 13.5 Snapshot Retention Policy

v2.1 places **no automatic limit** on the number of snapshots per account. Snapshots accumulate indefinitely unless manually deleted by a user. This is acceptable at current scale.

Monitor storage usage as snapshot count grows. Revisit with an automatic retention policy (e.g., max N snapshots per account, auto-expire after X months) if storage becomes a concern. No automatic cleanup is implemented in v2.1.

### 13.5 Restore Behavior (Transactional)

Restore must execute as a single transaction:
1. Create backup snapshot named: "לפני שחזור: {snapshot_name} — {date}"
2. Delete all current pages for the account
3. Insert pages from snapshot data (new IDs, preserved structure)
4. Log activity: snapshot_restored
5. Commit

If any step fails, rollback everything. The sitemap must not be in a partial state after a failed restore.

---

## 14. GSC Data

### 14.1 Per-Account

GSC data is stored per-account. Uploading GSC data for Account A does not affect Account B.

### 14.2 Upload (System Admin Only)

- Upload a CSV or GSC export file
- System parses and normalizes all URLs (see §14.3)
- Inserts into gsc_clicks table for the active account
- Previous GSC data for the account is replaced (not merged)
- Upload is logged in the activity feed

### 14.3 URL Normalization

A single reusable normalization function handles all URL matching throughout the app (GSC matching, sitemap URL deduplication, import matching). Rules:
- Lowercase domain and path
- Remove trailing slash
- Remove query string
- Remove hash fragment
- Convert absolute account-domain URLs to relative paths (e.g., https://colman.ac.il/about → /about)
- Treat /about and /about/ as equal
- Treat https://colman.ac.il/about and /about as equal when the domain matches account.domain

### 14.4 GSC Display

- Click count shown next to each page URL in the tree (matched by url_normalized)
- Pages with 0 clicks or no GSC match show nothing
- Color-coded by click thresholds (defined in UI-Spec.md)

### 14.5 GSC and Missing URLs

- URLs in gsc_clicks that match a sitemap page → shown in tree only
- URLs in gsc_clicks that do NOT match any sitemap page → shown in Missing URLs tab
- A URL cannot appear in both places simultaneously

---

## 15. Missing URLs Tab

- Shows URLs from GSC that have no matching page in the tree (matched by url_normalized)
- Sorted by clicks descending
- Supports single "Add Page" (pre-fills URL) and bulk add (select multiple → batch create)
- After a page is added for a URL, that URL disappears from this tab

---

## 16. Export / Import

### 16.1 Export

- Export current tree as JSON
- JSON includes all page fields
- Logged in activity feed

### 16.2 Import (Intelligent — Replaces Simple Import)

Import is a multi-step, analysis-driven process. See §17 for the full specification. Simple "replace everything" import is no longer a single-step action.

---

## 17. Intelligent Sitemap Import Engine

### 17.1 Purpose

Import data from Excel, CSV, or JSON files and intelligently construct or update a sitemap. This is not a raw data replacement — the engine analyzes the file, interprets structure, infers hierarchy, and proposes a sitemap for user review before applying.

### 17.2 Supported File Types

- .xlsx (Excel)
- .csv
- .json

### 17.2a Performance Limits

The following limits are enforced at the start of analysis, before any processing begins:

| Limit | Value |
|---|---|
| Maximum file size | 10 MB |
| Maximum rows in uploaded file | 20,000 |
| Maximum proposed pages generated | 10,000 |

If any limit is exceeded, analysis stops immediately with a validation error. No import_job is created. The user sees a clear Hebrew error message in the import modal (e.g., "הקובץ גדול מדי — מקסימום 10MB").

### 17.3 Import Modes

**Analyze Only**
Generate a proposed sitemap and show recommendations. Do not change the sitemap.

**Merge Into Existing Sitemap**
Add or update according to selected conflict behavior (see §17.4). Does not delete existing pages not present in the import.

**Create New Sitemap**
Replace current sitemap entirely. Requires confirmation. Auto-snapshot created first.

### 17.4 Import Conflict Behavior

Applies when import mode is "Merge Into Existing Sitemap."

**Option 1: Add New URLs Only**
- Imported URLs that already exist in the sitemap are skipped
- Only URLs not currently in the sitemap are created as new pages
- No existing pages are modified

**Option 2: Overwrite Existing URLs**
- If an imported URL matches an existing page (by url_normalized), update the existing page
- Updatable fields: name, parent, template, status, color, notes
- Do NOT change page ID
- Preserve activity history
- Log each overwrite in the import activity summary

### 17.5 Analysis Engine Requirements

The engine must:
- Parse the uploaded file (detect columns/fields)
- Use user-provided prompt to guide column interpretation and hierarchy logic
- Identify likely column mappings: name, URL, parent, category, section, template, status, notes
- Infer hierarchy from: explicit parent columns, URL path depth, category groupings, JSON nesting, repeated section names
- Suggest missing hub pages where a section has children but no defined parent page
- Detect duplicate URLs within the import file
- Detect invalid URLs (unparseable strings)
- Detect orphan pages (pages with a parent reference that does not exist in the import)
- Match imported URLs against existing sitemap pages (by url_normalized)
- Classify each proposed page with a conflict_status
- Generate a complete proposed sitemap tree for preview

### 17.6 ProposedPage Type

```typescript
interface ProposedPage {
  temp_id: string;
  parent_temp_id: string | null;
  matched_existing_page_id?: string | null;
  conflict_status: 'new' | 'existing_overwrite' | 'existing_skip' | 'duplicate' | 'invalid';
  name: string;
  url: string | null;
  url_normalized: string | null;
  template: string | null;
  status: PageStatus;
  color: string | null;
  notes: string | null;
  confidence: number;          // 0.0–1.0, engine's confidence in this proposal
  source_row?: number;         // Row number in source file
  reasoning?: string;          // Engine explanation for this proposal
}
```

### 17.7 Import Preview

Before applying, the user must see:
- Count and list of: new pages to create, existing pages to overwrite, existing pages to skip, duplicates, invalid rows
- Suggested hub pages
- Assumptions made by the engine (e.g., "Column B was interpreted as parent category")
- User can cancel, change conflict behavior, or confirm and apply

### 17.8 Apply Rules

- Always create an automatic snapshot before applying (named: "לפני ייבוא — {file_name} — {date}")
- Apply in a single transaction: no partial imports
- If transaction fails, rollback and report error
- Return counts: created, updated, skipped, invalid

### 17.9 Import Job Tracking

Import jobs are stored in the import_jobs table to allow users to review past imports. See Database.md for schema.

---

## 18. Admin Panel

Accessible only to System Admins. Contains:

### 18.1 Account Management

- List all accounts (active + archived)
- Create new account (name, slug, domain)
- Archive account (soft delete, data preserved)
- View account stats (page count, user count, last activity)

### 18.2 User Management

- List all users
- View which accounts each user is assigned to
- Add user to account
- Remove user from account
- Change user role (user ↔ system_admin)

### 18.3 GSC Upload

- Select account
- Upload CSV
- Preview first 10 rows
- Confirm upload

### 18.4 Account Detail — Danger Zone

Visible in Admin → Accounts → [Account Detail] at the bottom of the page.

---

## 19. Clear Sitemap (System Admin Only)

### 19.1 Access

Only System Admins can clear a sitemap. Regular users must never see this option.

### 19.2 Location

Admin → Accounts → [Account Detail] → Danger Zone section

### 19.3 What Clear Sitemap Does

Deletes ALL pages for the selected account. Does NOT delete:
- The account record
- Users or user assignments
- GSC data
- Activity log
- Snapshots

### 19.4 Safety Requirements (Two Confirmations)

**First Confirmation Modal**
Warning text (Hebrew):
"פעולה זו תמחק את כל מפת האתר של החשבון הנוכחי. הפעולה אינה מוחקת את החשבון, משתמשים, נתוני GSC או צלמיות."
Buttons: Cancel | Continue

**Second Confirmation Modal**
Require the admin to type the exact account name or slug to enable the final button.
Example: "להמשך, הקלד את שם החשבון: Colman"
The "Clear Sitemap" button is disabled until the typed value matches exactly (case-insensitive).

### 19.5 Clear Sitemap Execution (Transactional)

1. Create automatic snapshot named: "לפני מחיקת מפה — {account_name} — {date}"
2. Delete all pages for the account in a transaction
3. Log activity: sitemap_cleared with: account_id, account_name, deleted_page_count, backup_snapshot_id, cleared_by
4. Commit

If any step fails, rollback. No partial deletion.

---

## 20. AI Sitemap Assistant (Future Phase — Architecture Only)

Design the architecture now. Do NOT implement in v2.

### 20.1 Planned Features

- Detect orphan sections (pages with no parent and no children)
- Detect duplicate URL patterns
- Suggest hub pages for clusters of related pages
- Suggest content clusters based on names/templates
- Suggest internal linking opportunities
- Identify architecture gaps (e.g., department with no degree pages)

### 20.2 Architecture Constraints

- AI suggestions are read-only proposals
- User must explicitly approve each suggestion before any change is made
- No automatic modifications
- Suggestions are stored temporarily (not persisted)
- AI service is called via a server-side API route (not client-side)

---

## 21. Non-Goals (v2)

- No mobile app
- No magic link or social login
- No email notifications
- No page comments (use notes)
- No version diff editing (compare is view-only)
- No public sharing of sitemaps
- No billing or subscription management
- No AI implementation (architecture only)
- No page content editor
- No integration with CMS systems

---

## 22. Success Criteria

| Criteria | Measure |
|---|---|
| Account isolation | Data from Account A is never visible in Account B |
| Auto-save reliability | 0 data loss on normal usage |
| Presence accuracy | Online users visible within 30 seconds |
| RLS enforcement | Direct DB queries from user context return only their accounts |
| System admin isolation | Admin panel and Clear Sitemap inaccessible to regular users |
| Bulk operations | 50+ pages can be operated on in a single action |
| Snapshot integrity | Restored snapshot exactly matches original at time of save; restore is atomic |
| Import safety | No import partially applies; auto-snapshot always created before destructive imports |
| Clear sitemap safety | Two confirmations required; auto-snapshot always created before clearing |
