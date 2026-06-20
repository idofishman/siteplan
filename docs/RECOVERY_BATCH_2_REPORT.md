# Recovery Batch 2 Report — User Management & GSC

## Status: Complete

---

## 1. User Management

### API Changes

**`app/api/admin/users/route.ts`**
- `GET`: Enriched response with `is_banned` (from Supabase Auth `banned_until`) and `account_ids` (from `user_accounts` join table)
- `POST`: New endpoint — invites a user via `adminSupa.auth.admin.inviteUserByEmail(email, { data: { display_name, role } })`, upserts profile row

**`app/api/admin/users/[id]/route.ts`**
- `PATCH ?action=reset-password`: Generates a recovery link via `adminSupa.auth.admin.generateLink({ type: 'recovery', email })`, returns the link (admin copies to clipboard)
- `PATCH ?action=toggle-status`: Reads current `banned_until`, toggles ban_duration between `'none'` and `'876000h'` (100 years)
- `PATCH` with `{ account_ids: string[] }`: Replaces user's full account assignment list in `user_accounts` table
- `PATCH` with `{ display_name, role }`: Existing profile update (unchanged)
- `DELETE`: Unchanged

### UI Changes — `app/admin/users/page.tsx`

Full rewrite with:
- **Invite form**: Inline form at top with email (required), display name, role; sends POST to invite user; refreshes list on success
- **Inline name edit**: Click on name to edit in-place; Enter/blur saves via PATCH
- **Role select**: Unchanged behavior, now includes only valid roles (`system_admin`, `user`)
- **Status badge**: Active (green) / Banned (red) toggle; clicking sends `?action=toggle-status` PATCH
- **Account assignment**: Expand row to show checkboxes for all accounts; "Save assignments" button sends `{ account_ids }` PATCH
- **Reset password**: Button generates recovery link, copies to clipboard, shows alert with confirmation
- **Delete**: Unchanged

---

## 2. GSC Import

### DB Migration

**`supabase/migrations/20260620000003_gsc_period.sql`** — created:
```sql
ALTER TABLE gsc_clicks ADD COLUMN IF NOT EXISTS period varchar(10);
```

> **Note**: Supabase CLI was not found in the environment. You must run this migration manually:
> 1. Open Supabase Dashboard → SQL Editor → New Query
> 2. Paste and run the SQL above
> 3. The `period` column is nullable, so the app works without running it — existing rows will have `period = NULL`

### API Changes — `app/api/gsc/route.ts`

- Removed `requireSystemAdmin` check from `POST`
- Added `verifyAccountAccess(supabase, user.id, accountId)` instead — all account users can import
- Reads `period` from FormData; stores it on each inserted row
- Activity log now includes `period` in details

### UI Changes

**`components/gsc/GscUpload.tsx`**
- Added `period` state (default `'3m'`)
- Added period selector `<select>` above the drop zone: 28d / 1m / 3m / 6m / 1y
- `period` is sent as FormData field on upload

**`app/app/gsc/page.tsx`**
- Removed `isAdmin` state and `useAuth` usage
- Removed admin-only gate on `<GscUpload />`
- Removed "פנה למנהל" fallback message
- `<GscUpload />` is now shown to all users with account access

### Type Changes — `types/index.ts`

Added `period: string | null` field to `GscClick` interface.

---

## Verification

- `npx tsc --noEmit` — no errors
- `npm run build` — succeeded, all routes compiled
