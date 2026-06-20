'use client'

import { useState, useEffect } from 'react'
import { useAccountStore } from '@/stores/accountStore'
import { GscUpload } from '@/components/gsc/GscUpload'
import { MissingUrlsTable } from '@/components/gsc/MissingUrlsTable'
import { useTreeStore } from '@/stores/treeStore'
import type { GscClick } from '@/types'

export default function GscPage() {
  const { activeAccount } = useAccountStore()
  const { pages, loadPages } = useTreeStore()
  const [gscData, setGscData] = useState<GscClick[]>([])
  const [loadingGsc, setLoadingGsc] = useState(false)

  useEffect(() => {
    if (!activeAccount) return
    loadPages(activeAccount.id)
    setLoadingGsc(true)
    fetch(`/api/gsc?account_id=${activeAccount.id}`)
      .then(r => r.json())
      .then(data => { setGscData(Array.isArray(data) ? data : []); setLoadingGsc(false) })
  }, [activeAccount?.id])

  if (!activeAccount) return null

  const totalClicks = gscData.reduce((s, g) => s + g.clicks, 0)
  const matched = gscData.filter(g => pages.some(p => p.url_normalized === g.url_normalized)).length

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Google Search Console</h1>
        {gscData.length > 0 && (
          <div className="flex gap-4 text-sm text-slate-500">
            <span>סה&quot;כ: <b className="text-slate-700">{gscData.length}</b> עמודים</span>
            <span>קליקים: <b className="text-slate-700">{totalClicks.toLocaleString('he-IL')}</b></span>
            <span>ממופים: <b className="text-slate-700">{matched}</b></span>
          </div>
        )}
      </div>

      <GscUpload />

      {loadingGsc ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
        </div>
      ) : (
        <MissingUrlsTable gscData={gscData} />
      )}
    </div>
  )
}
