# Phase 8 Report — Presence System
**Date:** 2026-06-20  
**Status:** ✅ COMPLETE  
**Git commit:** `9e1e287`

---

## Files Created / Changed

| File | Action | Description |
|---|---|---|
| `stores/presenceStore.ts` | Created | Zustand store — `startHeartbeat`, `stopHeartbeat`, `setUsers`; interval-based heartbeat every 30s |
| `app/api/presence/heartbeat/route.ts` | Created | `POST /api/presence/heartbeat` — UPSERT presence row with display_name |
| `app/api/presence/cleanup/route.ts` | Created | `POST /api/presence/cleanup` — deletes rows older than 30 days; protected by `x-cron-secret` header |
| `components/presence/PresenceBar.tsx` | Created | Shows first 5 online users; "+N עוד" button for overflow; subscribes to Realtime |
| `components/presence/PresencePopover.tsx` | Created | Full list popup — name, avatar, active/inactive status with minutes-since label |
| `components/ui/Avatar.tsx` | Created | Initials avatar with green/amber status dot (start-aligned for RTL) |
| `app/app/layout.tsx` | Modified | Added `PresenceBar` between header and main content |

---

## Acceptance Criteria Status

| Criterion | Status | Notes |
|---|---|---|
| Current user appears in presence bar with green dot | ✅ | Heartbeat fires on mount; bar refreshes from Realtime |
| Second user in same account appears within 30 seconds | ✅ | Heartbeat interval is 30s; Realtime subscription triggers refresh |
| Users in different accounts do NOT see each other | ✅ | `filter: account_id=eq.${accountId}` on Realtime; DB query also scoped by `account_id` |
| Inactive user (2–10 min) shows yellow dot | ✅ | `computeStatus` checks diff < 2 min → active, else → inactive |
| User > 10 min inactive disappears | ✅ | Query filters `WHERE last_seen > now() - 10min` |
| When > 5 online: "+N עוד" → opens popover with full list | ✅ | `overflow > 0` shows button; popover shows all |
| Switching accounts stops old heartbeat, starts new one | ✅ | `stopHeartbeat()` + `startHeartbeat()` on `activeAccount.id` change in `useEffect` |

---

## Cron Route

`POST /api/presence/cleanup` is the cron target:
- Protected by `x-cron-secret` header matching `CRON_SECRET` env var
- Deletes all presence rows with `last_seen < now() - 30 days`
- Vercel Cron config goes in `vercel.json` (Phase 14)
