# Recovery Batch 3 Report — Sitemap Hierarchy & Delete Behavior

## Status: Complete

---

## 3. Homepage Root Enforcement — Always Expanded

**`stores/treeStore.ts`**

After `loadPages` resolves and sets the tree, it now finds the homepage node and calls `useUiStore.getState().expandAll([homepage.id])`. This ensures the homepage is always in the expanded set — even on first load before localStorage has any state.

The existing `collapseAll(keepId?)` action already supports keeping a single node expanded (used by the Collapse All button). The `keepId` value is the homepage id.

Note: `buildTree()` root enforcement and API auto-parenting (POST /api/pages, import apply) were completed in a prior session.

---

## 4. Right-Click Context Menu

**`stores/uiStore.ts`**
- Added `ContextMenuState` interface (`{ x, y, pageId }`)
- Added `contextMenu: ContextMenuState | null` to store
- Added `openContextMenu(state)` and `closeContextMenu()` actions
- `openModal()` now closes any open context menu

**`components/tree/ContextMenu.tsx`** (new)
- Renders via `createPortal(document.body)` to escape tree's overflow/clipping
- Positions at mouse coordinates, clamped to viewport boundaries
- Closes on any `mousedown` outside, or on scroll
- Menu items:
  - **+ הוסף עמוד ילד** — opens `addPage` modal with `{ parentId: node.id }`
  - **✏️ עריכה** — opens `editPage` modal
  - **📋 היסטוריית שינויים** — opens `pageHistory` modal
  - **🗑 מחיקה** — opens `deletePage` modal

**`components/tree/PageNode.tsx`**
- Added `onContextMenu` handler: calls `e.preventDefault()` then `openContextMenu({ x, y, pageId })`

**`components/tree/PageNodeMenu.tsx`** (3-dot menu)
- Added "📋 היסטוריית שינויים" option (opens `pageHistory` modal) between Edit and Delete

**`app/app/layout.tsx`**
- Added `<ContextMenu />` rendered at layout level

---

## 5. Page Change History Modal

**`app/api/activity/route.ts`**
- Added `entity_id` query param filter: `if (entityId) query = query.eq('entity_id', entityId)`

**`components/modals/PageHistoryModal.tsx`** (new)
- Opens when `activeModal === 'pageHistory'`
- Fetches `/api/activity?account_id=X&entity_id=Y` on open
- Displays timeline of activity log entries for the page
- Shows: user name, action label (Hebrew), relative time with exact date tooltip
- Empty state message if no history

**`app/app/layout.tsx`**
- Added `<PageHistoryModal />` rendered at layout level

---

## 6. Delete Page Reassignment

**`app/api/pages/[id]/route.ts`** — DELETE handler extended:
- Reads optional JSON body: `{ reassign_to?: string, cascade?: boolean }`
- **cascade=true**: Recursively finds all descendant ids, bulk-deletes all of them
- **reassign_to**: UPDATEs direct children to new `parent_id` before deleting the page
- **no options**: Simple delete (unchanged behavior — children get `parent_id = null`, buildTree absorbs them under homepage)
- Activity log includes details about reassignment or cascade count

**`stores/treeStore.ts`** — `deletePage` signature extended:
- `deletePage(id, options?: { reassign_to?: string; cascade?: boolean })`
- Optimistic update handles all three cases:
  - No options: filter out deleted page
  - cascade: filter out deleted page + all descendants (uses `getDescendantIds`)
  - reassign_to: filter out deleted page + remap children's `parent_id` optimistically
- After reassign/cascade, reloads pages from server to sync real state

**`components/modals/DeleteConfirmModal.tsx`** — full rewrite:
- When deleted page **has no children**: unchanged UI (simple confirm/cancel)
- When deleted page **has children**: shows reassignment panel with:
  - Radio "Reassign children" → `<select>` populated with all non-descendant pages (default: current parent)
  - Radio "Delete all children (N pages)"
- `useEffect` resets mode + reassignTo on each modal open
- Passes appropriate `options` to `deletePage()`

---

## Verification

- `npx tsc --noEmit` — no errors
- `npm run build` — succeeded, all 26 pages compiled
