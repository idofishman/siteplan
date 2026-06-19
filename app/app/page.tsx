'use client'

import { useAccountStore } from '@/stores/accountStore'
import { useTreeStore } from '@/stores/treeStore'
import { useUiStore } from '@/stores/uiStore'
import { PageTree } from '@/components/tree/PageTree'
import { SaveIndicator } from '@/components/ui/SaveIndicator'
import { AddEditPageModal } from '@/components/modals/AddEditPageModal'
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal'

export default function AppPage() {
  const { activeAccount } = useAccountStore()
  const { saveStatus } = useTreeStore()
  const { openModal } = useUiStore()

  if (!activeAccount) return null

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-slate-200 px-4 py-2 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700">מבנה האתר</span>
          <SaveIndicator status={saveStatus} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openModal('addPage', {})}
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            + הוסף עמוד
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto px-2 py-2">
        <PageTree accountId={activeAccount.id} />
      </div>

      {/* Modals */}
      <AddEditPageModal />
      <DeleteConfirmModal />
    </div>
  )
}
