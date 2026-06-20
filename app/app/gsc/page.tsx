'use client'

import { useState, useEffect } from 'react'
import { useAccountStore } from '@/stores/accountStore'
import { GscUpload } from '@/components/gsc/GscUpload'
import { MissingUrlsTable } from '@/components/gsc/MissingUrlsTable'
import { useTreeStore } from '@/stores/treeStore'
import type { GscClick } from '@/types'

export default function GscPage() {
  const { activeAccount } = useAccountStore()
  const { pages, loadPages, loadGsc } = useTreeStore()
  const [gscData, setGscData] = useState<GscClick[]>([])
  const [loadingGsc, setLoadingGsc] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [clearing, setClearing] = useState(false)

  async function fetchGsc(accountId: string) {
    setLoadingGsc(true)
    const res = await fetch(`/api/gsc?account_id=${accountId}`)
    const data = await res.json()
    const rows = Array.isArray(data) ? data : []
    setGscData(rows)
    setShowUpload(rows.length === 0)
    setLoadingGsc(false)
  }

  useEffect(() => {
    if (!activeAccount) return
    loadPages(activeAccount.id)
    fetchGsc(activeAccount.id)
  }, [activeAccount?.id])

  if (!activeAccount) return null

  const hasData = gscData.length > 0
  const totalClicks = gscData.reduce((s, g) => s + g.clicks, 0)
  const matched = gscData.filter(g => pages.some(p => p.url_normalized === g.url_normalized)).length

  async function handleClear() {
    if (!confirm('למחוק את כל נתוני GSC?')) return
    setClearing(true)
    await fetch(`/api/gsc?account_id=${activeAccount!.id}`, { method: 'DELETE' })
    setGscData([])
    setShowUpload(true)
    setClearing(false)
    await loadGsc(activeAccount!.id)
  }

  function handleUploadSuccess() {
    setShowUpload(false)
    fetchGsc(activeAccount!.id)
    loadGsc(activeAccount!.id)
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">Google Search Console</h1>
        {hasData && (
          <div className="flex gap-4 text-sm text-slate-500">
            <span>סה&quot;כ: <b className="text-slate-700">{gscData.length.toLocaleString('he-IL')}</b> עמודים</span>
            <span>קליקים: <b className="text-slate-700">{totalClicks.toLocaleString('he-IL')}</b></span>
            <span>ממופים: <b className="text-slate-700">{matched}</b></span>
          </div>
        )}
      </div>

      {/* GSC data controls — shown when data exists and not in re-upload mode */}
      {hasData && !showUpload && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm text-green-800 flex-1">נתוני GSC טעונים — {gscData.length.toLocaleString('he-IL')} עמודים</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUpload(true)}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
            >
              העלה נתונים חדשים
            </button>
            <button
              onClick={handleClear}
              disabled={clearing}
              className="text-sm px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
            >
              {clearing ? 'מוחק...' : 'נקה נתונים'}
            </button>
          </div>
        </div>
      )}

      {/* Upload section — shown when no data OR when re-uploading */}
      {(!hasData || showUpload) && (
        <div>
          {showUpload && hasData && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-600">העלאת נתוני GSC חדשים (יחליף נתונים קיימים)</span>
              <button onClick={() => setShowUpload(false)} className="text-sm text-slate-400 hover:text-slate-600">ביטול</button>
            </div>
          )}
          <GscUpload onSuccess={handleUploadSuccess} />
        </div>
      )}

      {/* Data table */}
      {loadingGsc ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
        </div>
      ) : (
        hasData && <MissingUrlsTable gscData={gscData} />
      )}
    </div>
  )
}
