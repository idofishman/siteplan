'use client'

import { useState } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useAccountStore } from '@/stores/accountStore'
import { useTreeStore } from '@/stores/treeStore'
import type { ImportPlan } from '@/lib/utils/importEngine'

export function ImportPreviewModal() {
  const { activeModal, modalPayload, closeModal } = useUiStore()
  const { activeAccount } = useAccountStore()
  const { loadPages } = useTreeStore()
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState<{ inserted: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const open = activeModal === 'importPreview'
  const plan = (modalPayload as ImportPlan) ?? null

  if (!open || !plan || !activeAccount) return null

  async function handleApply() {
    setApplying(true)
    setError(null)

    // Only send toAdd + toSkip — duplicates are excluded intentionally
    const allUrls = [...plan.toAdd, ...plan.toSkip]
    const res = await fetch('/api/import/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: activeAccount!.id, urls: allUrls }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'שגיאה בייבוא')
      setApplying(false)
      return
    }

    setDone(data)
    setApplying(false)
    await loadPages(activeAccount!.id)
  }

  const duplicates = plan.duplicates ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">תצוגה מקדימה לייבוא</h2>
            <p className="text-sm text-slate-500">
              {plan.newCount} יתווספו
              {plan.existingCount > 0 && ` · ${plan.existingCount} קיימים (יושמטו)`}
              {duplicates.length > 0 && ` · ${duplicates.length} כפולים (יושמטו)`}
            </p>
          </div>
          <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <span className="text-4xl">✅</span>
            <p className="text-slate-800 font-medium">יובאו {done.inserted} עמודים בהצלחה</p>
            <button onClick={closeModal} className="text-sm text-slate-500 hover:text-slate-700 underline">סגור</button>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1">
              {plan.toAdd.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-green-50 border-b border-green-100 text-sm font-medium text-green-700 sticky top-0">
                    יתווספו ({plan.toAdd.length})
                  </div>
                  {plan.toAdd.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-white hover:bg-green-50">
                      <span className="text-green-500 text-sm">+</span>
                      {u.name
                        ? <span className="text-sm text-slate-700 flex-1 truncate">{u.name}</span>
                        : null}
                      {u.url
                        ? <span className="text-xs text-slate-400 font-mono truncate max-w-[260px]" dir="ltr">{u.url}</span>
                        : null}
                    </div>
                  ))}
                </div>
              )}

              {duplicates.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-sm font-medium text-amber-700 sticky top-0">
                    כתובות כפולות בקובץ — יושמטו ({duplicates.length})
                  </div>
                  {duplicates.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 opacity-60">
                      <span className="text-amber-400 text-sm">≡</span>
                      {u.name
                        ? <span className="text-sm text-slate-500 flex-1 truncate">{u.name}</span>
                        : null}
                      {u.url
                        ? <span className="text-xs text-slate-400 font-mono truncate max-w-[260px]" dir="ltr">{u.url}</span>
                        : null}
                    </div>
                  ))}
                </div>
              )}

              {plan.toSkip.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-500 sticky top-0">
                    קיים — יושמט ({plan.toSkip.length})
                  </div>
                  {plan.toSkip.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 opacity-50">
                      <span className="text-slate-400 text-sm">–</span>
                      {u.name
                        ? <span className="text-sm text-slate-500 flex-1 truncate">{u.name}</span>
                        : null}
                      {u.url
                        ? <span className="text-xs text-slate-400 font-mono truncate max-w-[260px]" dir="ltr">{u.url}</span>
                        : null}
                      {u.existingPage && <span className="text-xs text-slate-400 mr-auto">{u.existingPage.name}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 shrink-0 flex items-center gap-3">
              {error && <p className="text-sm text-red-600 flex-1">{error}</p>}
              <div className="flex gap-2 mr-auto">
                <button onClick={closeModal} className="text-sm px-4 py-2 text-slate-500 hover:text-slate-700">
                  ביטול
                </button>
                <button
                  onClick={handleApply}
                  disabled={applying || plan.newCount === 0}
                  className="text-sm px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white transition-colors"
                >
                  {applying ? 'מייבא...' : `ייבא ${plan.newCount} עמודים`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
