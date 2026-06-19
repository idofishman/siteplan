'use client'

import { useState } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import { findNode } from '@/lib/utils/tree'

export function MoveConfirmModal() {
  const { activeModal, modalPayload, closeModal } = useUiStore()
  const { movePage, tree } = useTreeStore()
  const [moving, setMoving] = useState(false)

  const open = activeModal === 'movePage'
  const payload = modalPayload as {
    pageId: string
    pageName: string
    newParentId: string | null
    newSortOrder: number
  } | null

  if (!open || !payload) return null

  const newParentNode = payload.newParentId ? findNode(tree, payload.newParentId) : null
  const parentLabel = newParentNode ? newParentNode.name : 'שורש הדפים'

  async function handleConfirm() {
    if (!payload) return
    setMoving(true)
    await movePage(payload.pageId, payload.newParentId, payload.newSortOrder)
    closeModal()
    setMoving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800">העברת עמוד</h2>
        <p className="text-sm text-slate-600">
          להעביר את <strong>{payload.pageName}</strong> אל <strong>{parentLabel}</strong>?
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={moving}
            className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {moving ? 'מעביר...' : 'העבר'}
          </button>
          <button onClick={closeModal} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
