'use client'

import { useState, useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useAccountStore } from '@/stores/accountStore'
import type { ActivityEntry } from '@/types'

const ACTION_LABELS: Record<string, string> = {
  page_created: 'נוצר',
  page_edited: 'עודכן',
  page_moved: 'הועבר',
  page_deleted: 'נמחק',
  import_applied: 'יובא',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'עכשיו'
  if (mins < 60) return `לפני ${mins} דקות`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `לפני ${hours} שעות`
  const days = Math.floor(hours / 24)
  return `לפני ${days} ימים`
}

export function PageHistoryModal() {
  const { activeModal, modalPayload, closeModal } = useUiStore()
  const { activeAccount } = useAccountStore()
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(false)

  const open = activeModal === 'pageHistory'
  const payload = modalPayload as { pageId: string; pageName: string } | null

  useEffect(() => {
    if (!open || !payload || !activeAccount) return
    setLoading(true)
    fetch(`/api/activity?account_id=${activeAccount.id}&entity_id=${payload.pageId}`)
      .then(r => r.json())
      .then(data => { setEntries(data.entries ?? []); setLoading(false) })
  }, [open, payload?.pageId, activeAccount?.id])

  if (!open || !payload) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">היסטוריה: {payload.pageName}</h2>
          <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">אין היסטוריה עבור דף זה.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map(e => (
                <div key={e.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800">
                      <span className="font-medium">{e.user_name}</span>
                      {' '}
                      <span className="text-slate-500">{ACTION_LABELS[e.action] ?? e.action}</span>
                    </p>
                    {e.details && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {JSON.stringify(e.details)}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-xs text-slate-400 shrink-0"
                    title={new Date(e.created_at).toLocaleString('he-IL')}
                  >
                    {relativeTime(e.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
