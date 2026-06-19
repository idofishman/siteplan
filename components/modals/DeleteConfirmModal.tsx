'use client'

import { useState } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import { getAffectedDeleteCount } from '@/lib/utils/tree'

export function DeleteConfirmModal() {
  const { activeModal, modalPayload, closeModal, clearSelection } = useUiStore()
  const { deletePage, tree } = useTreeStore()
  const [deleting, setDeleting] = useState(false)

  const open = activeModal === 'deletePage'
  const payload = modalPayload as { pageId: string; pageName: string } | null

  if (!open || !payload) return null

  const totalAffected = getAffectedDeleteCount(tree, [payload.pageId])
  const hasChildren = totalAffected > 1

  async function handleConfirm() {
    if (!payload) return
    setDeleting(true)
    await deletePage(payload.pageId)
    clearSelection()
    closeModal()
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800">מחיקת עמוד</h2>
        <p className="text-sm text-slate-600">
          האם למחוק את הדף <strong>{payload.pageName}</strong>
          {hasChildren && (
            <span className="text-red-600">
              {' '}וכל הדפים שלו ({totalAffected} דפים בסך הכול)
            </span>
          )}
          ?
        </p>
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
