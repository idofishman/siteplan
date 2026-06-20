'use client'

import { useState, useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import { findNode } from '@/lib/utils/tree'

export function MoveConfirmModal() {
  const { activeModal, modalPayload, closeModal } = useUiStore()
  const { movePage, tree, pages } = useTreeStore()
  const [moving, setMoving] = useState(false)
  const [parentId, setParentId] = useState<string | null>(null)

  const open = activeModal === 'movePage'
  const payload = modalPayload as {
    pageId: string
    pageName: string
    newParentId: string | null
    newSortOrder: number
    isSameParent?: boolean
  } | null

  // Sync local parent with payload whenever modal opens
  useEffect(() => {
    if (open && payload) setParentId(payload.newParentId)
    if (!open) setParentId(null)
  }, [open])

  if (!open || !payload) return null

  const selectedParentNode = parentId ? findNode(tree, parentId) : null
  const parentLabel = selectedParentNode ? selectedParentNode.name : 'שורש הדפים'
  const parentChanged = parentId !== payload.newParentId
  const isSameParent = !parentChanged && payload.isSameParent

  async function handleConfirm() {
    if (!payload) return
    setMoving(true)
    await movePage(payload.pageId, parentId, payload.newSortOrder)
    closeModal()
    setMoving(false)
  }

  // Pages available as parent — exclude the page being moved and its descendants
  function isDescendant(nodeId: string, ancestorId: string): boolean {
    const node = findNode(tree, ancestorId)
    if (!node) return false
    return node.children.some(c => c.id === nodeId || isDescendant(nodeId, c.id))
  }
  const eligibleParents = pages.filter(p =>
    p.id !== payload.pageId && !isDescendant(p.id, payload.pageId)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800">
          {isSameParent ? 'שינוי סדר' : 'העברת עמוד'}
        </h2>

        <p className="text-sm text-slate-600">
          {isSameParent
            ? <>לשנות את מיקומו של <strong>{payload.pageName}</strong> בתפריט?</>
            : <>להעביר את <strong>{payload.pageName}</strong> אל <strong>{parentLabel}</strong>?</>
          }
        </p>

        {/* Parent picker — lets the user correct a mis-drop */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-500">עמוד הורה</label>
          <select
            value={parentId ?? ''}
            onChange={e => setParentId(e.target.value || null)}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">שורש הדפים</option>
            {eligibleParents.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {parentChanged && (
            <p className="text-xs text-amber-600">שונה מהמיקום שנגרר — הורה: {parentLabel}</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={moving}
            className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {moving ? 'שומר...' : isSameParent ? 'שמור סדר' : 'העבר'}
          </button>
          <button onClick={closeModal} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
