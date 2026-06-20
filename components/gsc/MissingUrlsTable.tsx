'use client'

import { useMemo, useState } from 'react'
import { useTreeStore } from '@/stores/treeStore'
import type { GscClick } from '@/types'

type FilterMode = 'missing' | 'pdf' | 'all'
type ClicksFilterType = 'gt' | 'lt'

interface Props {
  gscData: GscClick[]
}

export function MissingUrlsTable({ gscData }: Props) {
  const { pages } = useTreeStore()
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<FilterMode>('missing')
  const [clicksFilterType, setClicksFilterType] = useState<ClicksFilterType>('gt')
  const [clicksFilterValue, setClicksFilterValue] = useState('')

  const pageNormalizedSet = useMemo(
    () => new Set(pages.map(p => p.url_normalized).filter(Boolean)),
    [pages]
  )

  const hasClicksFilter = clicksFilterValue !== '' && !isNaN(Number(clicksFilterValue))

  const filtered = useMemo(() => {
    let rows = gscData

    // Mode filter
    if (mode === 'missing') {
      rows = rows.filter(g => !pageNormalizedSet.has(g.url_normalized))
    } else if (mode === 'pdf') {
      rows = rows.filter(g => g.url_original.toLowerCase().endsWith('.pdf'))
    }

    // Clicks filter
    if (hasClicksFilter) {
      const threshold = Number(clicksFilterValue)
      rows = rows.filter(g => {
        return clicksFilterType === 'gt' ? g.clicks > threshold : g.clicks < threshold
      })
    }

    // Search filter
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(g =>
        g.url_original.toLowerCase().includes(q) ||
        g.url_normalized.toLowerCase().includes(q)
      )
    }

    return rows
  }, [gscData, mode, pageNormalizedSet, search, hasClicksFilter, clicksFilterValue, clicksFilterType])

  const missingCount = useMemo(
    () => gscData.filter(g => !pageNormalizedSet.has(g.url_normalized)).length,
    [gscData, pageNormalizedSet]
  )
  const pdfCount = useMemo(
    () => gscData.filter(g => g.url_original.toLowerCase().endsWith('.pdf')).length,
    [gscData]
  )

  if (gscData.length === 0) return null

  const MODES: { key: FilterMode; label: string; count: number }[] = [
    { key: 'missing', label: 'חסרים במפה', count: missingCount },
    { key: 'pdf', label: 'קבצי PDF', count: pdfCount },
    { key: 'all', label: 'הכל', count: gscData.length },
  ]

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
        {/* Mode tabs */}
        <div className="flex items-center gap-1 shrink-0">
          {MODES.map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                mode === m.key
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {m.label}
              <span className={`mr-1 ${mode === m.key ? 'text-slate-300' : 'text-slate-400'}`}>
                ({m.count})
              </span>
            </button>
          ))}
        </div>

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
            type="number"
            min="0"
            value={clicksFilterValue}
            onChange={e => setClicksFilterValue(e.target.value)}
            placeholder="מספר"
            className="w-16 text-xs border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 [appearance:textfield]"
          />
          {clicksFilterValue && (
            <button onClick={() => setClicksFilterValue('')} className="text-slate-400 hover:text-slate-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* URL search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs ms-auto">
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי URL..."
            className="w-full text-xs border border-slate-300 rounded-lg py-1.5 pr-8 pl-6 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            dir="ltr"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">
          {gscData.length === 0 ? 'לא יובאו נתוני GSC' : 'לא נמצאו תוצאות'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-start px-4 py-2 text-xs font-medium text-slate-500">כתובת URL</th>
                  <th className="text-start px-4 py-2 text-xs font-medium text-slate-500">קליקים</th>
                  <th className="text-start px-4 py-2 text-xs font-medium text-slate-500">חשיפות</th>
                  <th className="text-start px-4 py-2 text-xs font-medium text-slate-500">מיקום ממוצע</th>
                  {mode !== 'missing' && (
                    <th className="text-start px-4 py-2 text-xs font-medium text-slate-500">סטטוס</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => {
                  const inSitemap = pageNormalizedSet.has(g.url_normalized)
                  return (
                    <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-700 font-mono text-xs max-w-xs truncate" dir="ltr">
                        <a href={g.url_original} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">
                          {g.url_original}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-slate-700 font-medium">{g.clicks.toLocaleString('he-IL')}</td>
                      <td className="px-4 py-2 text-slate-500">{g.impressions?.toLocaleString('he-IL') ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-500">{g.position ? g.position.toFixed(1) : '—'}</td>
                      {mode !== 'missing' && (
                        <td className="px-4 py-2">
                          {inSitemap
                            ? <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">במפה</span>
                            : <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">חסר</span>
                          }
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 text-center py-2">
            מציג {filtered.length} מתוך {gscData.length}
          </p>
        </>
      )}
    </div>
  )
}
