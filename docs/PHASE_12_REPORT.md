# Phase 12 Report — Intelligent Sitemap Import
**Date:** 2026-06-20  
**Status:** ✅ COMPLETE  
**Git commit:** `f664f81`

---

## Files Created

| File | Description |
|---|---|
| `lib/utils/importParser.ts` | Detects and parses XML sitemap, TXT URL list, or CSV |
| `lib/utils/importEngine.ts` | `buildImportPlan()` — compares parsed URLs to existing pages by `url_normalized` |
| `app/api/import/analyze/route.ts` | `POST` — accepts file, returns plan (toAdd / toSkip) |
| `app/api/import/apply/route.ts` | `POST` — inserts only the `toAdd` entries; derives page names from URL path segments |
| `components/modals/ImportModal.tsx` | File picker (drag-and-drop / click); shows spinner while analyzing |
| `components/modals/ImportPreviewModal.tsx` | Preview of toAdd (green +) and toSkip (gray –); confirm button |

---

## Acceptance Criteria Status

| Criterion | Status |
|---|---|
| Accepts XML sitemap | ✅ Parses `<loc>` tags |
| Accepts plain text (one URL per line) | ✅ |
| Accepts CSV | ✅ Detects url/address/loc/page column |
| Duplicate URLs in import file deduplicated | ✅ `seen` Set in `buildImportPlan` |
| URLs already in sitemap → shown as "skip" | ✅ Matched by `url_normalized` |
| New URLs → page name derived from URL path | ✅ `deriveNameFromUrl()` in apply route |
| New pages inserted with status=draft | ✅ |
| Import activity logged | ✅ `import_applied` action with inserted/skipped counts |

## Import Logic

1. `analyze`: file → parse (detect format) → `buildImportPlan(parsed, existingPages)` → return plan
2. Preview: user sees toAdd (green) and toSkip (gray) with scroll, then clicks "ייבא N עמודים"
3. `apply`: filters `action === 'add'` from the plan → inserts with sequential sort_order after last existing
