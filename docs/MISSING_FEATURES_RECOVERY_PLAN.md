# Missing Features Recovery Plan
**Date:** 2026-06-20  
**Status:** ✅ ALL BATCHES COMPLETE

---

## Summary Table

| # | Feature | Status | Batch |
|---|---------|--------|-------|
| 1 | Homepage root enforcement | ✅ Complete | 1 + 3 |
| 2 | Expand all / Collapse all | ✅ Complete | 1 |
| 3 | User management (full) | ✅ Complete | 2 |
| 4 | Import button in header | ✅ Complete | 1 |
| 5 | GSC import — all users + period | ✅ Complete | 2 |
| 6 | Hide "existing" status badge | ✅ Complete | 1 |
| 7 | Online user hover tooltip | ✅ Complete | 1 |
| 8 | Right-click context menu | ✅ Complete | 3 |
| 9 | Delete with child reassignment | ✅ Complete | 3 |
| 10 | Login page animation | ✅ Complete | 1 |

---

## Batch 1 — Completed

Features 2, 4, 6, 7, 10, + Last Edited indicator.
See git commit: "Recovery batch 1 UI features and last edited"

## Batch 2 — Completed

Features 3 (user management), 5 (GSC period + all-user access).  
See `docs/RECOVERY_BATCH_2_REPORT.md`.  
See git commit: "Recovery batch 2 user management and GSC"

> **Pending manual step:** Run `supabase/migrations/20260620000003_gsc_period.sql` in the Supabase Dashboard SQL Editor (Supabase CLI not found in this environment).

## Batch 3 — Completed

Features 1 (homepage always expanded), 8 (right-click menu), 9 (delete reassignment).  
See `docs/RECOVERY_BATCH_3_REPORT.md`.  
See git commit: "Recovery batch 3 sitemap hierarchy and delete behavior"
