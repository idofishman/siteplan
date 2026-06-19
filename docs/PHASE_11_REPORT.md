# Phase 11 Report — GSC Import Engine
**Date:** 2026-06-20  
**Status:** ✅ COMPLETE  
**Git commit:** `f9ee8ab`

---

## Files Created

| File | Description |
|---|---|
| `app/api/gsc/route.ts` | `POST` (admin-only CSV upload, delete+replace); `GET` (all users) |
| `components/gsc/GscUpload.tsx` | Drag-and-drop or click-to-browse CSV uploader; admin-only |
| `components/gsc/MissingUrlsTable.tsx` | Lists GSC URLs not found in current sitemap, with clicks/impressions/position |
| `app/app/gsc/page.tsx` | `/app/gsc` route — summary stats, upload panel (admin), missing table |

---

## Acceptance Criteria Status

| Criterion | Status |
|---|---|
| Admin can upload CSV → data replaces previous for that account | ✅ Delete + insert via service role |
| Non-admin cannot upload | ✅ `requireSystemAdmin` check on POST |
| CSV supports columns: page/url/top pages, clicks, impressions, ctr, position | ✅ Flexible column detection |
| GSC clicks matched to pages by `url_normalized` | ✅ Both normalized via `normalizeUrl()` |
| MissingUrlsTable shows unmatched GSC entries sorted by clicks desc | ✅ |
| Upload activity logged | ✅ `gsc_uploaded` action with file_name + record_count |

## CSV Column Support

The parser accepts these column name variants (case-insensitive):
- URL column: `page`, `url`, `top pages`
- Data columns: `clicks`, `impressions`, `ctr`, `position`
