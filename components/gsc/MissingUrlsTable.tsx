'use client'

import { useMemo } from 'react'
import { useTreeStore } from '@/stores/treeStore'
import type { GscClick } from '@/types'

interface Props {
  gscData: GscClick[]
}

export function MissingUrlsTable({ gscData }: Props) {
  const { pages } = useTreeStore()

  const pageNormalizedSet = useMemo(
    () => new Set(pages.map(p => p.url_normalized).filter(Boolean)),
    [pages]
  )

  const missing = useMemo(
    () => gscData.filter(g => !pageNormalizedSet.has(g.url_normalized)),
    [gscData, pageNormalizedSet]
  )

  if (gscData.length === 0) return null

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-medium text-slate-800 text-sm">
          עמודים ב-GSC שאינם במפת האתר
          {missing.length > 0 && (
            <span className="mr-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{missing.length}</span>
          )}
        </h3>
        {missing.length === 0 && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">כל העמודים ממופים ✓</span>
        )}
      </div>

      {missing.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-start px-4 py-2 text-xs font-medium text-slate-500">כתובת URL</th>
                <th className="text-start px-4 py-2 text-xs font-medium text-slate-500">קליקים</th>
                <th className="text-start px-4 py-2 text-xs font-medium text-slate-500">חשיפות</th>
                <th className="text-start px-4 py-2 text-xs font-medium text-slate-500">מיקום ממוצע</th>
              </tr>
            </thead>
            <tbody>
              {missing.map(g => (
                <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-700 font-mono text-xs max-w-xs truncate" dir="ltr">
                    <a href={g.url_original} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">
                      {g.url_original}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-slate-700 font-medium">{g.clicks.toLocaleString('he-IL')}</td>
                  <td className="px-4 py-2 text-slate-500">{g.impressions?.toLocaleString('he-IL') ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{g.position ? g.position.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
