'use client'

import { useState, useMemo, useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import { getAffectedDeleteCount, flatTree } from '@/lib/utils/tree'

type ReassignMode = 'reassign' | 'cascade'

export function DeleteConfirmModal() {
  const { activeModal, modalPayload, closeModal, clearSelection } = useUiStore()
  const { deletePage, tree, pages } = useTreeStore()
  const [deleting, setDeleting] = useState(false)
  const [mode, setMode] = useState<ReassignMode>('reassign')
  const [reassignTo, setReassignTo] = useState<string>('')

  const open = activeModal === 'deletePage'
  const payload = modalPayload as { pageId: string; pageName: string } | null

  // Find the page being deleted to get its parent (default reassignment target)
  const deletedPage = useMemo(() => pages.find(p => p.id === payload?.pageId), [pages, payload?.pageId])
  const defaultReassignId = deletedPage?.parent_id ?? ''

  // All pages except the deleted page and its descendants (can't reassign to self or children)
  const allDescendantIds = useMemo(() => {
    if (!payload) return new Set<string>()
    const flat = flatTree(tree)
    const result = new Set<string>()
    const collect = (id: string) => {
      result.add(id)
      for (const n of flat) {
        if (n.parent_id === id) collect(n.id)
      }
    }
    collect(payload.pageId)
    return result
  }, [payload?.pageId, tree])

  const reassignCandidates = useMemo(
    () => pages.filter(p => !allDescendantIds.has(p.id)),
    [pages, allDescendantIds]
  )

  // Reset state when modal opens for a new page
  useEffect(() => {
    if (open) {
      setMode('reassign')
      setReassignTo('')
      setDeleting(false)
    }
  }, [open, payload?.pageId])

  if (!open || !payload) return null

  const totalAffected = getAffectedDeleteCount(tree, [payload.pageId])
  const hasChildren = totalAffected > 1
  const childCount = totalAffected - 1

  // Initialize reassignTo from default if not yet set
  const effectiveReassignTo = reassignTo || defaultReassignId

  async function handleConfirm() {
    if (!payload) return
    setDeleting(true)

    if (!hasChildren) {
      await deletePage(payload.pageId)
    } else if (mode === 'cascade') {
      await deletePage(payload.pageId, { cascade: true })
    } else {
      await deletePage(payload.pageId, { reassign_to: effectiveReassignTo || undefined })
    }

    clearSelection()
    closeModal()
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800">מחיקת עמוד</h2>

        <p className="text-sm text-slate-600">
          האם למחוק את הדף <strong>{payload.pageName}</strong>?
        </p>

        {hasChildren && (
          <div className="flex flex-col gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-medium text-amber-800">
              לדף זה יש {childCount} דף{childCount !== 1 ? 'ים' : ''} ילד. מה לעשות איתם?
            </p>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="delete-mode"
                value="reassign"
                checked={mode === 'reassign'}
                onChange={() => setMode('reassign')}
                className="mt-0.5 accent-blue-600"
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-slate-700">שייך מחדש לדף אחר</span>
                {mode === 'reassign' && (
                  <select
                    value={effectiveReassignTo}
                    onChange={e => setReassignTo(e.target.value)}
                    className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 max-w-full"
                  >
                    <option value="">ללא הורה (שורש)</option>
                    {reassignCandidates.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.url ? ` (${p.url})` : ''}
                        {p.id === defaultReassignId ? ' — הורה נוכחי' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="delete-mode"
                value="cascade"
                checked={mode === 'cascade'}
                onChange={() => setMode('cascade')}
                className="accent-red-600"
              />
              <span className="text-sm text-red-700">
                מחק גם את כל הדפים הילדים ({childCount} דפים)
              </span>
            </label>
          </div>
        )}

        <p className="text-xs text-slate-400">פעולה זו לא ניתנת לביטול.</p>

        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {deleting ? 'מוחק...' : 'מחק'}
          </button>
          <button onClick={closeModal} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
