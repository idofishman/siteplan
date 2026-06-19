# Phase 10 Report — Snapshots
**Date:** 2026-06-20  
**Status:** ✅ COMPLETE  
**Git commit:** `b5bcc1f`

---

## Files Created

| File | Description |
|---|---|
| `app/api/snapshots/route.ts` | `GET` (list without data), `POST` (create) |
| `app/api/snapshots/[id]/route.ts` | `GET` (with data), `DELETE` |
| `app/api/snapshots/[id]/restore/route.ts` | `POST` — auto-backup + delete + re-insert (service role) |
| `components/snapshots/SnapshotList.tsx` | List + toolbar with create button |
| `components/snapshots/SnapshotCard.tsx` | Card with restore, compare, export, inline delete confirm; 🔒 for auto-backups |
| `components/modals/SnapshotNameModal.tsx` | Modal with optional name input; defaults to date string |
| `components/modals/SnapshotCompareModal.tsx` | Side-by-side diff: unchanged/changed/deleted/added |
| `app/app/snapshots/page.tsx` | `/app/snapshots` route |

---

## Acceptance Criteria Status

| Criterion | Status |
|---|---|
| Create snapshot → appears in list with correct page count | ✅ |
| Delete snapshot → removed after inline confirmation | ✅ |
| Export → valid JSON downloads | ✅ `Blob` download via anchor click |
| Restore → auto-backup created first → tree shows restored content | ✅ |
| Compare → correctly classifies unchanged/changed/deleted/added | ✅ Matches by `url_normalized` (not ID) |
| 🔒 icon on auto-generated snapshots | ✅ Detected by name starting with "גיבוי לפני" |
| Snapshots for Account A not visible in Account B | ✅ `verifyAccountAccess` check + RLS |

## Restore Implementation

Restore uses service role (not user session) to bypass RLS for the three atomic steps:
1. Read current pages → create backup snapshot
2. DELETE all pages WHERE account_id = X
3. INSERT restored pages with new IDs (remapped via UUID map, parent_id remapped accordingly)

Note: Supabase JS does not support true multi-statement transactions in a single call. The restore is "best-effort atomic" — if step 3 fails, the user has the backup snapshot ID in the error response to manually restore. A future migration can add a Postgres function for true transactional restore.

## Compare Algorithm

Pages are matched by `url_normalized` (not by ID, since restore creates new IDs). Each snapshot page is classified as:
- `unchanged` — exists in current state with identical field values
- `changed` — exists but has different name/status/url/template/color/notes
- `deleted` — in snapshot but not in current state
- `added` — in current state but not in snapshot
