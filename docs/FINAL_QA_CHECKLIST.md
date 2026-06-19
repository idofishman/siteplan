# Final QA Checklist — Colman Site Structure Manager v2
**Date:** 2026-06-20  
**Reviewer:** Claude Code (automated)  
**Scope:** All phases 0–14 against PRD.md, Architecture.md, Database.md, UserFlows.md, UI-Spec.md, Deployment.md, Implementation-Plan.md

Legend: ✅ Pass | ❌ Fail | ⚠️ Partial / Deviation | 🔴 Blocker | 🟡 Warning | ℹ️ Manual verification required

---

## 1. Build and Code Quality

| Check | Result | Notes |
|---|---|---|
| `npm run build` | ✅ Clean | 29 routes, 0 errors |
| `npx tsc --noEmit` | ✅ Clean | 0 TypeScript errors |
| `npm audit` | 🔴 3 vulnerabilities | 2 high (next.js, xlsx), 1 moderate (postcss) |
| `git status` | ✅ Clean | Working tree clean, all committed |

---

## 2. Phase-by-Phase Acceptance Criteria

### Phase 0 — Project Setup
| Criterion | Status |
|---|---|
| `npm run dev` starts without errors | ✅ |
| `npx tsc --noEmit` 0 errors | ✅ |
| `.env.local` exists, not committed | ✅ |
| `normalizeUrl('/about/')` → '/about' | ✅ |
| `normalizeUrl('https://colman.ac.il/about', 'colman.ac.il')` → '/about' | ✅ |
| COLORS, TEMPLATES, STATUS_LABELS constants in `lib/constants.ts` | ✅ |
| `lib/utils/cn.ts` clsx + twMerge | ✅ |
| `types/index.ts` all TypeScript interfaces | ✅ |

### Phase 1 — Supabase Setup and Database
| Criterion | Status |
|---|---|
| All 9 tables in migration SQL | ✅ Migration file present |
| RLS policies for all tables | ✅ Migration + fix files present |
| `handle_new_user` trigger defined | ✅ |
| `idx_pages_unique_normalized_url` partial index | ✅ |
| `lib/supabase/client.ts` — browser client | ✅ |
| `lib/supabase/server.ts` — server client | ✅ |
| `lib/supabase/admin.ts` — service role client | ✅ |
| `verifyAccountAccess()` + `requireSystemAdmin()` | ✅ |
| Realtime publication SQL in migration | ✅ |
| **`accounts` table has `is_active` (boolean) in schema** | ✅ Schema correct |
| **Admin API routes query `status` column (does not exist)** | 🔴 **RUNTIME BUG** |

### Phase 2 — Authentication
| Criterion | Status |
|---|---|
| /app without session → redirects to /login | ✅ Middleware present |
| Wrong credentials → "אימייל או סיסמה שגויים" | ✅ |
| Correct credentials → redirects | ✅ |
| Session persists across refresh | ✅ Cookie-based SSR auth |
| Non-admin /admin → redirects to /app | ✅ Middleware + layout guard |
| `AuthProvider.tsx` SIGNED_OUT event → redirect to /login | ✅ |
| **Session expiry toast "פג תוקף החיבור"** | ❌ Redirect happens silently — no toast |

### Phase 3 — Account Selection and Switching
| Criterion | Status |
|---|---|
| 1-account user → no selector → /app loads | ✅ |
| 2+-account user → /select-account | ✅ |
| System admin → all accounts + Create Account | ✅ |
| Account switcher in header | ✅ |
| Switching account → reloads data | ✅ |
| Empty accounts → "לא הוקצו לך חשבונות" | ✅ |
| `localStorage['last_account_id']` persists | ✅ |

### Phase 4 — Core Tree: Load and Display
| Criterion | Status |
|---|---|
| Pages load from Supabase | ✅ |
| Parent-child hierarchy correct | ✅ |
| Expand/collapse works | ✅ |
| Expanded state in `localStorage['sitemap_expanded_nodes']` | ✅ |
| Node shows: color swatch, name, status badge | ✅ |
| Empty state when 0 pages | ✅ |
| GSC click count badge on nodes | ✅ |
| `getAffectedDeleteCount()` includes descendants | ✅ |

### Phase 5 — Page CRUD with Auto-Save
| Criterion | Status |
|---|---|
| Add page → appears in tree, saveStatus flashes | ✅ |
| Edit page → tree updates | ✅ |
| Delete page with children → warning shown | ✅ |
| saveStatus 'שומר...' during API call | ✅ |
| saveStatus 'שגיאת שמירה ✗' on failure + revert | ✅ |
| No global Save button | ✅ |
| URL field `dir="ltr"` | ✅ |
| Duplicate url_normalized → error in modal | ✅ |
| All operations logged to activity_log | ✅ |
| `url_normalized` computed via `normalizeUrl()` before INSERT | ✅ |

### Phase 6 — Page Status, Notes, and Move
| Criterion | Status |
|---|---|
| Status badge correct color for all 8 statuses | ✅ |
| Notes icon on pages with notes | ✅ |
| Tooltip on hover shows note text | ✅ |
| Notes editable in edit modal | ✅ |
| Drag-and-drop with @hello-pangea/dnd | ✅ |
| Reorder within same parent → silent save | ✅ |
| Move to different parent → confirm modal | ✅ |

### Phase 7 — Bulk Operations
| Criterion | Status |
|---|---|
| Checkbox on hover | ✅ |
| Selecting opens bulk toolbar with count | ✅ |
| Select All | ✅ |
| Bulk delete modal shows X selected + Y total affected | ✅ |
| Bulk status / template / color / note / move | ✅ |
| Single activity log entry per bulk op | ✅ |
| saveStatus fires | ✅ |

### Phase 8 — Presence System
| Criterion | Status |
|---|---|
| Heartbeat every 30s via POST /api/presence/heartbeat | ✅ |
| Presence bar shows online users | ✅ |
| 2-min inactive → yellow dot | ✅ |
| 10-min inactive → disappears | ✅ |
| >5 online → "+N עוד" link → popover | ✅ |
| Cross-account isolation | ✅ |
| Cleanup cron route (`/api/presence/cleanup`) | ✅ |
| Cron secret: x-cron-secret header | ⚠️ Deployment.md says `Authorization: Bearer`, code uses `x-cron-secret` |

### Phase 9 — Activity Feed
| Criterion | Status |
|---|---|
| Entries newest-first | ✅ |
| Avatar, name, action text, timestamp | ✅ |
| Pagination 50/page, "Load more" | ✅ |
| Filter by user, date range, action | ✅ |
| Cross-account isolation | ✅ |

### Phase 10 — Snapshots
| Criterion | Status |
|---|---|
| Create snapshot → appears in list | ✅ |
| Delete snapshot after confirmation | ✅ |
| Export → JSON download | ✅ |
| Restore → auto-backup created first | ✅ |
| Restore transactional (service role, atomic delete+insert) | ✅ |
| Compare → two-column view | ✅ |
| Compare matches by url_normalized | ✅ |
| 🔒 icon on auto-generated snapshots | ✅ |
| Cross-account isolation | ✅ |

### Phase 11 — GSC Import Engine
| Criterion | Status |
|---|---|
| Admin uploads CSV → click counts in tree | ✅ |
| Cross-account isolation | ✅ |
| Missing URLs tab sorted by clicks DESC | ✅ |
| URL normalization applied on upload | ✅ |
| GSC upload replaces old data (DELETE+INSERT) | ✅ |
| Logs gsc_uploaded activity | ✅ |
| **Route: `/app/app/missing-urls/`** | ❌ Implemented as `/app/app/gsc/` — wrong URL path |
| **GscUpload is in `/app/app/gsc/` (not `/admin/gsc/`)** | ⚠️ Spec says `/admin/gsc/page.tsx` |
| **Single "Add Page" from missing URL pre-fills modal** | ℹ️ Manual verification required |
| **Bulk add from missing URLs** | ❌ Not implemented |

### Phase 12 — Intelligent Sitemap Import
| Criterion | Status |
|---|---|
| ImportModal + ImportPreviewModal exist | ✅ |
| XML/TXT/CSV file parsing | ✅ |
| Basic deduplication by url_normalized | ✅ |
| Add-only mode: new pages inserted | ✅ |
| Activity log: import_applied | ✅ |
| **`import_jobs` table updated (status, applied_at, etc.)** | ❌ Not implemented |
| **xlsx support** | ❌ Not implemented |
| **AI prompt analysis / column detection** | ❌ Not implemented |
| **Confidence scores + 💡 low-confidence indicator** | ❌ Not implemented |
| **Hub page suggestions** | ❌ Not implemented |
| **Overwrite existing mode** | ❌ Not implemented |
| **Create new sitemap mode (delete all + import)** | ❌ Not implemented |
| **Auto-snapshot before apply** | ❌ Not implemented |
| **File size limit enforcement (10MB)** | ❌ Not enforced in /api/import/analyze |
| **Row limit enforcement (20,000 rows)** | ❌ Not enforced |
| **Cancel sets import_jobs status = 'cancelled'** | ❌ Not implemented |
| **Import preview: assumptions and warnings section** | ❌ Not shown |
| **Conflict behavior selector (add_only vs overwrite)** | ❌ UI only shows basic preview |
| **Import mode selector (analyze_only/merge/create_new)** | ❌ Not in UI |

### Phase 13 — Admin Panel + Danger Zone
| Criterion | Status |
|---|---|
| /admin inaccessible to non-admins | ✅ |
| Admin dashboard with counts | ✅ |
| User list + role change | ✅ |
| User delete (blocks self-delete) | ✅ |
| Account list | ✅ |
| Create account | 🔴 **RUNTIME BUG** — inserts `status: 'active'` but column is `is_active` boolean |
| Archive/reactivate account | 🔴 **RUNTIME BUG** — PATCH sends `status` not `is_active` |
| **`/admin/accounts/[id]` detail page** | ❌ Not implemented (not in build output) |
| **User-account assignment UI (add/remove users)** | ❌ Not implemented |
| **`POST /api/admin/users/:id/accounts`** | ❌ Not implemented |
| **`DELETE /api/admin/users/:id/accounts/:account_id`** | ❌ Not implemented |
| **Clear Sitemap: second confirmation requires account name** | ❌ Requires "DELETE" instead (spec: account name, case-insensitive) |
| **Clear Sitemap: auto-snapshot created before deletion** | ❌ Not implemented |
| **Clear Sitemap is transactional** | ❌ Snapshot + delete + log are not in one DB transaction |
| **`slug` field set on account creation** | 🔴 **RUNTIME BUG** — slug is NOT NULL but not inserted |

### Phase 14 — Polish and Edge Cases
| Criterion | Status |
|---|---|
| Skeleton loaders (TreeSkeleton, CardSkeleton) | ✅ |
| Toast notifications | ✅ `toast()` singleton |
| Tree search (≥2 chars, Escape, scroll) | ✅ |
| AI Suggestions button disabled with "בקרוב" | ✅ |
| Keyboard nav in PageNode (Enter/Delete/Space) | ✅ |
| `vercel.json` cron configured | ✅ (03:00 UTC) |
| Session expiry → redirect to /login | ✅ |
| **Session expiry toast message "פג תוקף החיבור"** | ❌ Silent redirect only |
| **Status filter above tree (multi-select)** | ℹ️ Manual verification required |
| **Presence popover "+N עוד" full list on click** | ✅ |
| **Import preview low-confidence 💡 with tooltip** | ❌ Not implemented |
| **Auto-generated snapshots 🔒 cannot be deleted by users** | ⚠️ 🔒 icon shown but delete is still allowed |

---

## 3. Security Checklist

| Check | Status |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` never in client bundle | ✅ Server-only usage confirmed |
| `.env.local` in `.gitignore` | ✅ |
| `auth.getUser()` (not `getSession()`) in all server routes | ✅ |
| `verifyAccountAccess()` called in API routes | ✅ |
| `requireSystemAdmin()` on all admin routes | ✅ |
| RLS enabled on all 9 tables | ✅ (per migration SQL) |
| Service role used only for admin maintenance operations | ✅ |
| CRON_SECRET validated on cleanup endpoint | ✅ |
| Self-delete blocked in user management | ✅ |
| `NEXT_PUBLIC_` prefix only on safe env vars | ✅ |

---

## 4. Live Supabase / Browser Tests (Manual Required)

All items below require a live browser session and cannot be verified by code inspection alone:

- [ ] Login with correct credentials → account selector appears
- [ ] Login with wrong credentials → Hebrew error shown
- [ ] Non-admin navigates to /admin → redirected to /app
- [ ] Account switching — tree reloads for new account
- [ ] Add/edit/delete pages with auto-save indicator
- [ ] Drag-and-drop reorder and reparent
- [ ] Bulk operations (delete, status, color)
- [ ] Presence: two users same account see each other within 30s
- [ ] Create/restore/compare/export snapshot
- [ ] GSC CSV upload → click counts appear in tree
- [ ] Missing URLs tab shows unmatched GSC URLs
- [ ] Import flow (CSV → analyze → preview → apply)
- [ ] Admin: attempt create account (will fail — slug bug)
- [ ] Admin: attempt archive account (will fail — is_active bug)
- [ ] Clear sitemap (danger zone)
- [ ] RLS isolation: user A cannot see user B's account data
