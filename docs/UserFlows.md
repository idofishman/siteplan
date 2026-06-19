# UserFlows.md — Colman Site Structure Manager v2
**Version:** 2.1.1  
**Status:** Final  
**Date:** 2026-06-19  
**Audience:** Claude Code (implementation reference)

All flows are described from the user's perspective with system responses at each step. RTL Hebrew UI is assumed throughout.

---

## Flow 1: Login (Single Account User)

**Precondition:** User has an account on the system and is assigned to exactly one Account.

1. User navigates to the app URL
2. System detects no active session → redirect to /login
3. Login page shows: email field, password field, "התחבר" button
4. User enters email and password → clicks "התחבר"
5. System calls Supabase Auth signInWithPassword using user's credentials
6. On success: system fetches profile and account assignments via user's session (RLS applies)
7. User has exactly 1 assigned account → store account_id in localStorage → redirect to /app
8. App loads: tree, GSC data, presence for that account

**Error states:**
- Wrong credentials → show "אימייל או סיסמה שגויים" below form
- No internet → show "שגיאת חיבור, נסה שוב"
- Account archived → show "חשבון זה אינו פעיל"

---

## Flow 2: Login (Multi-Account User)

**Precondition:** User is assigned to 2 or more Accounts.

1–5. Same as Flow 1
6. On success: system fetches assignments, finds more than 1 account
7. Check localStorage for sitemap_active_account:
   - If stored account_id is in the user's assignment list → auto-select it, go to /app directly
   - Otherwise → redirect to /select-account
8. Account Selector screen shows all assigned accounts sorted: last used first, then alphabetical
9. User clicks an account card → store in localStorage → redirect to /app
10. App loads: tree, GSC, presence for selected account

---

## Flow 3: Login (System Admin)

**Precondition:** User has role = 'system_admin'.

1–5. Same as Flow 1
6. On success: system fetches all active accounts (RLS allows system_admin to see all)
7. Check localStorage for previously selected account → auto-select if valid
8. If no stored account: redirect to /select-account
9. Account Selector shows all accounts sorted by last used then alphabetical, plus "Create New Account" button
10. Admin selects account → /app loads
11. Admin panel link visible in header navigation

---

## Flow 4: Account Switching

**Precondition:** User is in /app with Account A active. User has access to Account B.

1. User clicks Account Switcher dropdown in header
2. Dropdown shows all accessible accounts. Current account has checkmark.
3. User clicks Account B name
4. System:
   a. Stops presence heartbeat for Account A
   b. Clears tree, GSC, activity, snapshots, presence from store
   c. Sets Account B as active in localStorage
   d. Starts presence heartbeat for Account B
   e. Loads pages, GSC, presence for Account B
5. Header updates, tree shows Account B's sitemap

---

## Flow 5: View Sitemap Tree

**Precondition:** User is in /app with an account loaded.

1. Tree displays hierarchical list of pages
2. Each node shows: expand/collapse toggle, color swatch, page name, status badge, notes icon (if has notes), GSC click count (if URL matches), kebab menu (on hover), checkbox (on hover)
3. Hovering over notes icon → tooltip shows note text
4. User clicks expand toggle → children appear

---

## Flow 6: Add Page

1. User right-clicks a page node OR clicks kebab → "הוסף עמוד בן"
   OR clicks "הוסף עמוד שורש" in toolbar
2. Add Page modal opens: name (required), URL (optional), status (default: existing), template, color, notes
3. User fills in fields → clicks "שמור"
4. System:
   a. Validates name is not empty
   b. Computes url_normalized via normalizeUrl(url, account.domain)
   c. Checks uniqueness constraint (url_normalized within account)
   d. Sends POST /api/pages using user's session
   e. Sets saveStatus = 'saving'
   f. API saves to DB (RLS enforces account scope), logs activity
   g. Store updates local state, rebuilds tree
   h. Sets saveStatus = 'saved' (fades after 3s)
5. Modal closes, new page appears in tree
6. Other users in the same account see the change via Realtime within ~1 second

**Error: duplicate URL** → modal stays open, shows "כתובת זו כבר קיימת במפה"

---

## Flow 7: Edit Page

1. User clicks kebab → "ערוך" OR double-clicks page name
2. Edit modal opens with current values pre-filled
3. User modifies fields → clicks "שמור"
4. System sends PATCH /api/pages/:id, logs page_edited with old and new values
5. Tree updates, saveStatus flashes saved

---

## Flow 8: Delete Page

1. User clicks kebab → "מחק"
2. Confirm modal:
   - No children: "האם למחוק את [name]?"
   - Has children: "עמוד זה מכיל X עמודים בנים. מחיקה תמחק גם אותם."
3. User confirms → DELETE /api/pages/:id → cascades to children → tree updates

---

## Flow 9: Move Page (Drag and Drop)

1. User drags page → drop zone highlights on target
2. User drops → Move Confirm modal: "להעביר [name] אל תוך [target]?"
3. Confirm → PATCH /api/pages/:id with new parent_id, logs page_moved
4. Re-order within same parent (no confirm needed): silent save

---

## Flow 10: Bulk Operations

1. User hovers page → checkbox appears → clicks checkbox → bulk toolbar appears at bottom
2. User selects multiple pages (or "בחר הכל")
3. Toolbar shows: count + action buttons
4. User clicks action (e.g., "מחיקה")
5. For bulk delete: system calculates affected_count = selected pages + ALL descendants of selected pages
   Confirmation modal shows: "X עמודים נבחרו. סה"כ Y עמודים יימחקו (כולל עמודים בנים)."
6. User confirms → POST /api/pages/bulk → single transaction → logs bulk activity entry
7. Selection cleared, toolbar hides

---

## Flow 11: View and Filter Activity Feed

1. User clicks "פעילות" tab
2. Feed shows last 50 events, newest first
3. Each entry: avatar initial, name, action text, relative time (hover → absolute)
4. User opens filter panel: by user, date range, action type
5. "טען עוד" loads next 50 entries

---

## Flow 12: Create Snapshot

1. User clicks "צלמית חדשה" in toolbar
2. Name modal opens → user enters name → clicks "צור"
3. System creates snapshot from current pages, logs snapshot_created
4. Success toast, snapshot appears in list

---

## Flow 13: Restore Snapshot (Transactional)

1. User in /app/snapshots, clicks "שחזר" on a snapshot
2. Confirmation modal:
   "שחזור צלמית: [name]
   פעולה זו תחליף את המפה הנוכחית.
   צלמית גיבוי תיווצר אוטומטית לפני השחזור."
3. User clicks "שחזר"
4. System executes in a single transaction:
   a. Creates auto-snapshot: "לפני שחזור: [name] — [date]"
   b. Deletes all current pages for account
   c. Inserts pages from snapshot data
   d. Logs activity: snapshot_restored
   e. Commits
   If any step fails → full rollback → error shown to user
5. Tree reloads showing restored sitemap
6. Success toast: "הצלמית שוחזרה בהצלחה"

---

## Flow 14: Compare Snapshot

1. User clicks "השווה" on a snapshot
2. Full-width compare modal:
   - Left column: snapshot pages (at creation time)
   - Right column: current pages
3. Color coding: green = unchanged, blue = changed, red = deleted, yellow = added
4. User closes modal

---

## Flow 15: Search and Filter Tree

1. User clicks search icon or presses Ctrl+F
2. Search bar appears at top of tree
3. User types → tree filters in real-time (shows matching pages + their ancestors)
4. Additional filters above tree: status (multi-select), template (dropdown), color (swatches)
5. Clearing search shows full tree

---

## Flow 16: Export JSON

1. User clicks "ייצא JSON" in toolbar
2. System fetches all pages for account → builds nested JSON → triggers file download
3. Logged in activity feed as json_exported

---

## Flow 17: Import Sitemap Data (Intelligent Import)

**Precondition:** User is in /app.

**Step 1 — Open Import Modal**

1. User clicks "ייבא נתונים" in toolbar
2. Import modal opens with:
   - File upload (accepts .xlsx, .csv, .json)
   - Prompt/instructions textarea: "Describe the data structure or what you want the engine to do"
   - Import mode selector: Analyze Only / Merge Into Existing / Create New Sitemap
   - Conflict behavior selector (shown only if mode = Merge): Add New URLs Only / Overwrite Existing
   - "נתח" (Analyze) button

**Step 2 — Analysis**

3. User selects a file, fills in prompt if needed, selects mode and conflict behavior
4. User clicks "נתח"
5. System:
   a. Uploads file to server via POST /api/import/analyze
   b. Engine parses file, detects columns, applies prompt guidance
   c. Normalizes all URLs (calls normalizeUrl() for each)
   d. Fetches existing pages for account → compares url_normalized
   e. Classifies each row as: new / existing_overwrite / existing_skip / duplicate / invalid
   f. Infers hierarchy (from parent columns, URL depth, category groupings)
   g. Suggests hub pages where needed
   h. Saves result to import_jobs (status = ready_for_review)
   i. Returns ImportAnalysisResult
6. Modal transitions to Import Preview

**Step 3 — Preview**

7. Import Preview modal shows:
   - Summary counts: "45 עמודים חדשים | 12 יידרסו | 8 ידולגו | 2 כפולים | 1 שגוי"
   - Proposed pages list grouped by conflict_status
   - Warnings and assumptions made by the engine (highlighted in yellow)
   - For each proposed page with low confidence: reasoning shown in tooltip
   - User can: Cancel / Change conflict behavior / Confirm and Apply

**Step 4 — Apply**

8. User clicks "החל ייבוא"
9. System:
   a. POST /api/import/apply with approved proposals and conflict_behavior
   b. API creates auto-snapshot: "לפני ייבוא — {file_name} — {date}"
   c. If mode = create_new_sitemap: deletes all current pages first
   d. Applies all proposals in a single transaction
   e. Updates import_jobs status to 'applied'
   f. Logs activity: import_applied with counts
   g. Commits transaction
10. Tree reloads with new data
11. Success toast: "ייבוא הושלם — X עמודים נוצרו, Y עודכנו, Z דולגו"

**Cancel Flow**

If user cancels at any point after analysis:
- Updates import_jobs status to 'cancelled'
- Logs activity: import_cancelled
- No changes to sitemap

**Error — Partial Failure**

If the apply transaction fails:
- Full rollback — no partial state
- Error toast with details
- import_jobs status = 'failed'

---

## Flow 18: Missing URLs Tab

1. User clicks "כתובות חסרות" tab
2. Table shows: GSC URLs with no matching sitemap page (url_normalized comparison), sorted by clicks DESC
3. Single add: click "הוסף עמוד" → Add Page modal with URL pre-filled
4. Bulk add: select multiple rows → "הוסף עמודים נבחרים" → batch create with default fields

---

## Flow 19: Admin — Create Account

1. Admin in /admin/accounts → clicks "צור חשבון חדש"
2. Form: name (required), slug (auto-generated from name, editable), domain (optional)
3. Admin submits → POST /api/accounts (admin route, uses service role for creation)
4. Admin redirected to new account detail page

---

## Flow 20: Admin — Assign User to Account

1. Admin viewing Account detail page → "הוסף משתמש"
2. Search modal: admin types email or name
3. System searches profiles (using service role to access all profiles)
4. Admin selects user → POST /api/admin/users/:id/accounts
5. User appears in assignment list. Activity logged.

---

## Flow 21: Admin — Upload GSC File

1. Admin in /admin/gsc → selects account
2. Uploads CSV file
3. System shows preview of first 10 rows (url_original | clicks)
4. Admin confirms → POST /api/gsc
5. API: deletes existing gsc_clicks for account, normalizes URLs, inserts new rows
6. Success: "X כתובות נטענו בהצלחה"

---

## Flow 22: Admin — Clear Sitemap (Danger Zone)

**Precondition:** User is system admin, viewing an Account's detail page.

**First Confirmation**

1. Admin scrolls to "Danger Zone" section at bottom of account detail page
2. Admin clicks "מחק מפה"
3. Warning modal opens:
   "פעולה זו תמחק את כל מפת האתר של החשבון הנוכחי. הפעולה אינה מוחקת את החשבון, משתמשים, נתוני GSC או צלמיות."
   Buttons: "ביטול" | "המשך"
4. Admin clicks "המשך"

**Second Confirmation**

5. Stronger warning modal opens with:
   - Red border / warning icon
   - Text: "להמשך, הקלד את שם החשבון: [account_name]"
   - Text input field
   - "מחק מפה" button (disabled until input matches)
6. Admin types the account name exactly (case-insensitive match)
7. "מחק מפה" button enables
8. Admin clicks "מחק מפה"

**Execution (Single Transaction)**

9. System executes DELETE /api/accounts/:id/sitemap (admin only, service role).
   All three steps run inside a **single database transaction**:
   a. Creates auto-snapshot: "לפני מחיקת מפה — {account_name} — {date}"
   b. Deletes all pages for account
   c. Logs activity: sitemap_cleared (with deleted_page_count and backup_snapshot_id)
   d. Commits transaction
10. **If any step fails → full rollback of all three steps:**
    - Sitemap remains unchanged (no pages deleted)
    - Snapshot is NOT created
    - Activity is NOT logged
    - Error shown to user
11. Success toast: "מפת האתר נמחקה. צלמית גיבוי נוצרה."
12. Tree shows empty state

---

## Flow 23: View Presence

1. Presence bar in header shows online users for current account
2. Shows first 5 users: active (🟢), inactive (🟡 + "לא פעיל X דקות")
3. If more than 5 users online: "+N עוד" link appears
4. Clicking "+N עוד" → popover lists ALL online users
5. Presence updates every 30 seconds automatically

---

## Flow 24: Logout

1. User clicks avatar/name in header → dropdown: email + "התנתק"
2. System:
   a. Deletes user's presence row for current account
   b. Stops heartbeat interval
   c. Calls supabase.auth.signOut()
   d. Clears localStorage (sitemap_active_account)
   e. Redirects to /login
