'use client'

import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import { flatTree } from '@/lib/utils/tree'

export function BulkToolbar() {
  const { selectedPageIds, clearSelection, selectAll, openModal } = useUiStore()
  const { tree } = useTreeStore()
  const count = selectedPageIds.size

  if (count === 0) return null

  function handleSelectAll() {
    const allIds = flatTree(tree).map(n => n.id)
    selectAll(allIds)
  }

  return (
    <div className="sticky top-0 z-10 bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-3 text-sm">
      <span className="font-medium text-blue-800">{count} עמודים נבחרו</span>
      <span className="text-blue-300">|</span>

      <button onClick={handleSelectAll} className="text-blue-700 hover:text-blue-900">
        בחר הכל
      </button>
      <button onClick={clearSelection} className="text-blue-700 hover:text-blue-900">
        בטל בחירה
      </button>

      <span className="text-blue-300">|</span>

      <button
        onClick={() => openModal('bulkChangeStatus', { pageIds: [...selectedPageIds] })}
        className="text-blue-700 hover:text-blue-900"
      >
        שנה סטטוס
      </button>
      <button
        onClick={() => openModal('bulkChangeTemplate', { pageIds: [...selectedPageIds] })}
        className="text-blue-700 hover:text-blue-900"
      >
        שנה תבנית
      </button>
      <button
        onClick={() => openModal('bulkChangeColor', { pageIds: [...selectedPageIds] })}
        className="text-blue-700 hover:text-blue-900"
      >
        שנה צבע
      </button>
      <button
        onClick={() => openModal('bulkAddNote', { pageIds: [...selectedPageIds] })}
        className="text-blue-700 hover:text-blue-900"
      >
        הוסף הערה
      </button>
      <button
        onClick={() => openModal('bulkMove', { pageIds: [...selectedPageIds] })}
        className="text-blue-700 hover:text-blue-900"
      >
        העבר
      </button>

      <span className="flex-1" />

      <button
        onClick={() => openModal('bulkDelete', { pageIds: [...selectedPageIds] })}
        className="text-red-600 hover:text-red-800 font-medium"
      >
        מחק
      </button>
    </div>
  )
}
