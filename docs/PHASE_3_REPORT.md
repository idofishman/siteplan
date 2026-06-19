# Phase 3 Report — Account Selection and Switching
**Date:** 2026-06-20  
**Status:** ✅ COMPLETE  
**Git commit:** `2439642`

---

## Files Created / Changed

| File | Action | Description |
|---|---|---|
| `app/api/accounts/route.ts` | Created | `GET /api/accounts` — returns accessible accounts (admin: all; user: assigned only) |
| `app/api/me/route.ts` | Created | `GET /api/me` — returns current user profile (id, display_name, role, email) |
| `stores/accountStore.ts` | Created | Zustand store — accounts, activeAccount, loadAccounts, setActiveAccount, clearAccount |
| `components/account/AccountSelector.tsx` | Created | Card grid for selecting account; last-used first, alphabetical; admin sees "Create Account" |
| `components/account/AccountSwitcher.tsx` | Created | Header dropdown to switch between accessible accounts |
| `app/select-account/page.tsx` | Created | Account selector page with auto-select logic |
| `app/app/layout.tsx` | Modified | Full app shell with header, AccountSwitcher, user name, admin link, logout |
| `middleware.ts` | Modified | Added `/select-account` to protected matcher |

---

## API Endpoints Added

### `GET /api/accounts`

Returns accounts accessible to the current user:
- System admin → all `is_active = true` accounts
- Regular user → only accounts in their `user_accounts` rows that are `is_active = true`
- RLS enforces isolation at DB level; API check is defense-in-depth

### `GET /api/me`

Returns:
```json
{ "id": "...", "display_name": "...", "role": "system_admin|user", "created_at": "...", "email": "..." }
```

Used by app shell layout and select-account page to show user name and conditionally show admin links.

---

## Account Selection Flow

```
User logs in → /app layout loads
  → loadAccounts() + GET /api/me (parallel)
  → If 0 accounts → redirect to /select-account → shows "לא הוקצו לך חשבונות"
  → If 1 account → auto-select → render /app
  → If 2+ accounts:
      → Check localStorage 'last_account_id'
      → If stored ID is in accounts list → auto-select → render /app
      → If no stored ID → redirect to /select-account → show account cards
          → User clicks card → setActiveAccount → /app
```

---

## Acceptance Criteria Status

| Criterion | Status | Notes |
|---|---|---|
| User with 1 account → login → no selector → /app loads | ✅ | Auto-selected in app layout |
| User with 2+ accounts → /select-account with cards | ✅ | Cards sorted: last used first, then alphabetical |
| System admin → sees all accounts + "Create Account" button | ✅ | isAdmin determined from `/api/me` response |
| Returning user with stored account → auto-selected | ✅ | localStorage `last_account_id` checked on every load |
| Account switcher in header shows current account name | ✅ | `AccountSwitcher` in app shell header |
| Switching account → app reloads with new account data | ✅ | `setActiveAccount` + `router.refresh()` |
| Account with 0 assignments → empty state | ✅ | "לא הוקצו לך חשבונות" with logout link |

---

## Implementation Notes

- `accountStore` uses `zustand` without persistence middleware — localStorage is managed manually via `LAST_ACCOUNT_KEY = 'last_account_id'` for explicit control
- The `/select-account` page now added to middleware matcher so unauthenticated users are redirected to `/login`
- `AccountSwitcher` uses Tailwind `start-0` logical property (RTL-safe) for the dropdown position
- App shell layout is a Client Component because it needs `useEffect` for account loading — this is correct; the page components under `/app/*` can still be Server Components
- `GET /api/accounts` for regular users uses `user_accounts!inner(user_id)` join to avoid returning accounts with no assignment, then strips the join field from the response body

---

## Issues Found and Fixed

None during Phase 3. TypeScript check passed, build passed.

---

## Build Output

```
Route (app)                              Size     First Load JS
┌ ƒ /                                    142 B          87.5 kB
├ ○ /app                                 142 B          87.5 kB
├ ○ /login                               1.15 kB        88.5 kB
└ ○ /select-account                      3.06 kB        90.4 kB
ƒ /api/accounts                          0 B
ƒ /api/me                                0 B

ƒ Middleware                             82.4 kB
```
