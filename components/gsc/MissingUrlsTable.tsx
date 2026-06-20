'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { useTreeStore } from '@/stores/treeStore'
import type { GscClick } from '@/types'

type ModeFilter = 'missing' | 'all'
type PdfFilter = 'all' | 'only_pdf' | 'hide_pdf'
type ClicksFilterType = 'gt' | 'lt'

interface ContextMenuState { x: number; y: number; row: GscClick }

interface Props {
  gscData: GscClick[]
}

interface AddModalState {
  urls: string[]
  parentId: string
}

export function MissingUrlsTable({ gscData }: Props) {
  const { pages, addPage } = useTreeStore()
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<ModeFilter>('missing')
  const [pdfFilter, setPdfFilter] = useState<PdfFilter>('all')
  const [clicksFilterType, setClicksFilterType] = useState<ClicksFilterType>('gt')
  const [clicksFilterValue, setClicksFilterValue] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [addModal, setAddModal] = useState<AddModalState | null>(null)
  const [adding, setAdding] = useState(false)
  const contextRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    function close() { setContextMenu(null) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [contextMenu])

  const pageNormalizedSet = useMemo(
    () => new Set(pages.map(p => p.url_normalized).filter(Boolean)),
    [pages]
  )

  const hasClicksFilter = clicksFilterValue !== '' && !isNaN(Number(clicksFilterValue))

  const filtered = useMemo(() => {
    let rows = gscData

    if (mode === 'missing') rows = rows.filter(g => !pageNormalizedSet.has(g.url_normalized))

    if (pdfFilter === 'only_pdf') rows = rows.filter(g => g.url_original.toLowerCase().endsWith('.pdf'))
    else if (pdfFilter === 'hide_pdf') rows = rows.filter(g => !g.url_original.toLowerCase().endsWith('.pdf'))

    if (hasClicksFilter) {
      const threshold = Number(clicksFilterValue)
      rows = rows.filter(g => clicksFilterType === 'gt' ? g.clicks > threshold : g.clicks < threshold)
    }

    const q = search.trim().toLowerCase()
    if (q) rows = rows.filter(g => g.url_original.toLowerCase().includes(q) || g.url_normalized.toLowerCase().includes(q))

    return rows
  }, [gscData, mode, pdfFilter, pageNormalizedSet, search, hasClicksFilter, clicksFilterValue, clicksFilterType])

  const missingCount = useMemo(() => gscData.filter(g => !pageNormalizedSet.has(g.url_normalized)).length, [gscData, pageNormalizedSet])

  if (gscData.length === 0) return null

  // Selection helpers
  const allFilteredIds = filtered.map(g => g.url_normalized)
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id))
  function toggleAll() {
    setSelected(allSelected
      ? new Set([...selected].filter(id => !allFilteredIds.includes(id)))
      : new Set([...selected, ...allFilteredIds])
    )
  }
  function toggleOne(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const selectedInFiltered = filtered.filter(g => selected.has(g.url_normalized))

  function openAddModal(urls: string[]) {
    setAddModal({ urls, parentId: pages.find(p => p.template === 'homepage')?.id ?? '' })
    setContextMenu(null)
  }

  async function handleAddToSitemap() {
    if (!addModal || !addModal.urls.length) return
    setAdding(true)
    for (const url of addModal.urls) {
      const name = (() => {
        try {
          const parts = new URL(url).pathname.split('/').filter(Boolean)
          return parts[parts.length - 1]?.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\.\w+$/, '') || url
        } catch { return url }
      })()
      await addPage({ url, name, parent_id: addModal.parentId || null, status: 'existing' })
    }
    setAdding(false)
    setAddModal(null)
    setSelected(new Set())
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
        {/* Mode tabs */}
        <div className="flex items-center gap-1 shrink-0">
          {([['missing', `חסרים במפה (${missingCount})`], ['all', `הכל (${gscData.length})`]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${mode === key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* PDF dropdown */}
        <select
          value={pdfFilter}
          onChange={e => setPdfFilter(e.target.value as PdfFilter)}
          className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 shrink-0"
        >
          <option value="all">הצג הכל</option>
          <option value="only_pdf">הצג רק PDF</option>
          <option value="hide_pdf">הסתר PDF</option>
        </select>

        {/* Clicks filter */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-slate-500">קליקים:</span>
          <select
            value={clicksFilterType}
            onChange={e => setClicksFilterType(e.target.value as ClicksFilterType)}
            className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="gt">יותר מ</option>
            <option value="lt">פחות מ</option>
          </select>
          <input
            type="number" min="0" value={clicksFilterValue}
            onChange={e => setClicksFilterValue(e.target.value)}
            placeholder="מספר"
            className="w-16 text-xs border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 [appearance:textfield]"
          />
          {clicksFilterValue && (
            <button onClick={() => setClicksFilterValue('')} className="text-slate-400 hover:text-slate-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* URL search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs ms-auto">
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי URL..." dir="ltr"
            className="w-full text-xs border border-slate-300 rounded-lg py-1.5 pr-8 pl-6 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
          <span className="text-xs text-blue-700 font-medium">{selected.size} נבחרו</span>
          <button
            onClick={() => openAddModal(selectedInFiltered.map(g => g.url_original))}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            + הוסף למפה
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-blue-500 hover:text-blue-700 ms-auto">
            בטל בחירה
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">לא נמצאו תוצאות</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-blue-600" />
                  </th>
                  <th className="text-start px-4 py-2 text-xs font-medium text-slate-500">כתובת URL</th>
                  <th className="text-start px-4 py-2 text-xs font-medium text-slate-500">קליקים</th>
                  <th className="text-start px-4 py-2 text-xs font-medium text-slate-500">חשיפות</th>
                  <th className="text-start px-4 py-2 text-xs font-medium text-slate-500">מיקום</th>
                  {mode === 'all' && <th className="text-start px-4 py-2 text-xs font-medium text-slate-500">סטטוס</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => {
                  const inSitemap = pageNormalizedSet.has(g.url_normalized)
                  const isSelected = selected.has(g.url_normalized)
                  return (
                    <tr
                      key={g.id}
                      className={`border-b border-slate-100 hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`}
                      onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, row: g }) }}
                    >
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleOne(g.url_normalized)} className="accent-blue-600" />
                      </td>
                      <td className="px-4 py-2 text-slate-700 font-mono text-xs max-w-xs truncate" dir="ltr">
                        <a href={g.url_original} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">
                          {g.url_original}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-slate-700 font-medium">{g.clicks.toLocaleString('he-IL')}</td>
                      <td className="px-4 py-2 text-slate-500">{g.impressions?.toLocaleString('he-IL') ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-500">{g.position ? g.position.toFixed(1) : '—'}</td>
                      {mode === 'all' && (
                        <td className="px-4 py-2">
                          {inSitemap
                            ? <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">במפה</span>
                            : <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">חסר</span>}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 text-center py-2">מציג {filtered.length} מתוך {gscData.length}</p>
        </>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="fixed z-[9999] w-44 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={e => e.stopPropagation()}
        >
          {!pageNormalizedSet.has(contextMenu.row.url_normalized) && (
            <button
              onClick={() => openAddModal([contextMenu.row.url_original])}
              className="w-full text-right px-4 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <span>+</span> הוסף למפה
            </button>
          )}
          <a
            href={contextMenu.row.url_original}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setContextMenu(null)}
            className="w-full text-right px-4 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <span>🔗</span> פתח עמוד
          </a>
        </div>
      )}

      {/* Add to sitemap modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAddModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800">הוספה למפת האתר</h2>
            <p className="text-sm text-slate-600">
              {addModal.urls.length === 1
                ? <><span className="font-mono text-xs break-all">{addModal.urls[0]}</span></>
                : <>{addModal.urls.length} עמודים נבחרו</>}
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">עמוד הורה</label>
              <select
                value={addModal.parentId}
                onChange={e => setAddModal(m => m ? { ...m, parentId: e.target.value } : null)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">ללא הורה (שורש)</option>
                {pages.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddToSitemap}
                disabled={adding}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {adding ? 'מוסיף...' : `הוסף${addModal.urls.length > 1 ? ` ${addModal.urls.length} עמודים` : ''}`}
              </button>
              <button onClick={() => setAddModal(null)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
