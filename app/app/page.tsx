'use client'

import { useState, useMemo } from 'react'
import { useAccountStore } from '@/stores/accountStore'
import { useTreeStore } from '@/stores/treeStore'
import { useUiStore } from '@/stores/uiStore'
import { PageTree } from '@/components/tree/PageTree'
import { SaveIndicator } from '@/components/ui/SaveIndicator'
import { AddEditPageModal } from '@/components/modals/AddEditPageModal'
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal'
import { MoveConfirmModal } from '@/components/modals/MoveConfirmModal'
import { BulkToolbar } from '@/components/tree/BulkToolbar'
import { BulkActionModal } from '@/components/modals/BulkActionModal'

type ClicksFilterType = 'gt' | 'lt'

export default function AppPage() {
  const { activeAccount } = useAccountStore()
  const { saveStatus, pages, gscClicks } = useTreeStore()
  const { openModal, expandAll, collapseAll } = useUiStore()
  const [search, setSearch] = useState('')
  const [clicksFilterType, setClicksFilterType] = useState<ClicksFilterType>('gt')
  const [clicksFilterValue, setClicksFilterValue] = useState('')

  const homepageId = pages.find(p => p.template === 'homepage' && !p.parent_id)?.id

  const hasClicksFilter = clicksFilterValue !== '' && !isNaN(Number(clicksFilterValue))

  const visibleIds = useMemo<Set<string> | null>(() => {
    const q = search.trim().toLowerCase()
    if (!q && !hasClicksFilter) return null

    const parentMap = new Map(pages.map(p => [p.id, p.parent_id]))
    const childrenMap = new Map<string, string[]>()
    for (const p of pages) {
      if (p.parent_id) {
        if (!childrenMap.has(p.parent_id)) childrenMap.set(p.parent_id, [])
        childrenMap.get(p.parent_id)!.push(p.id)
      }
    }

    function addAncestors(id: string, visible: Set<string>) {
      const parentId = parentMap.get(id)
      if (parentId) { visible.add(parentId); addAncestors(parentId, visible) }
    }
    function addDescendants(id: string, visible: Set<string>) {
      for (const childId of childrenMap.get(id) ?? []) {
        visible.add(childId); addDescendants(childId, visible)
      }
    }

    const threshold = hasClicksFilter ? Number(clicksFilterValue) : 0

    const candidates = pages.filter(p => {
      const nameMatch = !q || p.name.toLowerCase().includes(q) || (p.url && p.url.toLowerCase().includes(q))
      if (!nameMatch) return false
      if (!hasClicksFilter) return true
      const clicks = p.url_normalized ? (gscClicks[p.url_normalized] ?? 0) : 0
      return clicksFilterType === 'gt' ? clicks > threshold : clicks < threshold && clicks >= 0
    })

    if (candidates.length === 0) return new Set<string>()

    const visible = new Set<string>()
    for (const p of candidates) {
      visible.add(p.id)
      addAncestors(p.id, visible)
      if (q) addDescendants(p.id, visible)
    }
    return visible
  }, [search, hasClicksFilter, clicksFilterType, clicksFilterValue, pages, gscClicks])

  if (!activeAccount) return null

  const hasGscData = Object.keys(gscClicks).length > 0
  const isFiltering = visibleIds !== null

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-slate-200 px-4 py-2 flex items-center gap-3 bg-white shrink-0 flex-wrap">
        {/* Left: title + collapse */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-medium text-slate-700">מבנה האתר</span>
          <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{pages.length.toLocaleString('he-IL')} עמודים</span>
          <SaveIndicator status={saveStatus} />
          <div className="flex items-center gap-1 border-r border-slate-200 pr-3 mr-1">
            <button
              onClick={() => expandAll(pages.map(p => p.id))}
              className="text-xs px-2 py-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              הרחב הכל
            </button>
            <button
              onClick={() => collapseAll(homepageId)}
              className="text-xs px-2 py-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              כווץ הכל
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או URL..."
            className="w-full text-sm border border-slate-300 rounded-lg py-1.5 pr-9 pl-8 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            dir="rtl"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Clicks filter — only show when GSC data is available */}
        {hasGscData && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-slate-500">קליקים:</span>
            <select
              value={clicksFilterType}
              onChange={e => setClicksFilterType(e.target.value as ClicksFilterType)}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="gt">יותר מ</option>
              <option value="lt">פחות מ</option>
            </select>
            <input
              type="number"
              min="0"
              value={clicksFilterValue}
              onChange={e => setClicksFilterValue(e.target.value)}
              placeholder="מספר"
              className="w-20 text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 [appearance:textfield]"
            />
            {clicksFilterValue && (
              <button onClick={() => setClicksFilterValue('')} className="text-slate-400 hover:text-slate-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Right: result count + add */}
        <div className="flex items-center gap-2 ms-auto shrink-0">
          {isFiltering && visibleIds !== null && (
            <span className="text-xs text-slate-400">{visibleIds.size} תוצאות</span>
          )}
          <button
            onClick={() => openModal('addPage', {})}
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            + הוסף עמוד
          </button>
        </div>
      </div>

      <BulkToolbar />

      <div className="flex-1 overflow-auto px-2 py-2">
        <PageTree accountId={activeAccount.id} visibleIds={visibleIds} searchQuery={search.trim() || undefined} />
      </div>

      <AddEditPageModal />
      <DeleteConfirmModal />
      <MoveConfirmModal />
      <BulkActionModal />
    </div>
  )
}
