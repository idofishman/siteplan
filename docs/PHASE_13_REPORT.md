# Phase 13 Report — Admin Panel + Danger Zone
**Date:** 2026-06-20  
**Status:** ✅ COMPLETE  
**Git commit:** `e1e1948`

---

## Files Created

| File | Description |
|---|---|
| `app/admin/layout.tsx` | Admin shell with nav (סקירה/משתמשים/חשבונות) + back-to-app link |
| `app/admin/page.tsx` | Overview page: users count, active accounts count, pages count |
| `app/admin/users/page.tsx` | User table with inline role dropdown + delete |
| `app/admin/accounts/page.tsx` | Accounts table with create form, status toggle, danger zone |
| `app/api/admin/users/route.ts` | `GET` all users with emails (via auth.admin.listUsers) |
| `app/api/admin/users/[id]/route.ts` | `PATCH` role/name; `DELETE` via auth.admin.deleteUser |
| `app/api/admin/accounts/route.ts` | `GET` all accounts; `POST` create new account |
| `app/api/admin/accounts/[id]/route.ts` | `PATCH` name/domain/status; `DELETE ?action=clear-sitemap` |
| `components/modals/ClearSitemapModal.tsx` | Two-step: warning + type "DELETE" to confirm |

---

## Acceptance Criteria Status

| Criterion | Status |
|---|---|
| `/admin` protected by middleware (non-admin → redirect to /app) | ✅ Already in Phase 2/3 middleware |
| Admin overview shows correct counts | ✅ Parallel queries with `count: 'exact'` |
| User list with email (from auth.admin API) | ✅ Service role used for `listUsers` |
| Role change inline → takes effect immediately | ✅ |
| Delete user → removes from auth + cascade in DB | ✅ `auth.admin.deleteUser` cascades |
| Cannot delete yourself | ✅ Check `params.id === user.id` |
| Create account with optional domain | ✅ |
| Toggle account active/inactive | ✅ PATCH status field |
| Clear sitemap — two-step: warning modal → type "DELETE" → confirm | ✅ |
| Clear sitemap uses service role for DELETE bypass | ✅ |
| Clear sitemap logged in activity_log | ✅ `sitemap_cleared` action |

## Security Notes

- All admin API routes check `requireSystemAdmin()` as the first guard
- Middleware provides a second layer (non-admin users see 403 before they reach the API)
- `auth.admin.listUsers` and `auth.admin.deleteUser` use service role client (server-side only)
- The service role key is never sent to the browser
