'use client'

import { useState } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import { useAccountStore } from '@/stores/accountStore'
import { getAffectedDeleteCount } from '@/lib/utils/tree'
import { COLORS, STATUS_LABELS } from '@/lib/constants'
import { TemplateSelect } from '@/components/ui/TemplateSelect'
import type { BulkAction, PageStatus } from '@/types'

const STATUSES: PageStatus[] = ['planned', 'existing', 'in_progress', 'needs_review', 'approved', 'deprecated', 'redirect', 'archived']

export function BulkActionModal() {
  const { activeModal, modalPayload, closeModal, clearSelection } = useUiStore()
  const { bulkOperation, tree } = useTreeStore()
  const { activeAccount } = useAccountStore()

  const modalMap: Record<string, BulkAction> = {
    bulkChangeStatus: 'change_status',
    bulkChangeTemplate: 'change_template',
    bulkChangeColor: 'change_color',
    bulkAddNote: 'add_note',
    bulkMove: 'move',
    bulkDelete: 'delete',
  }

  const action = activeModal ? modalMap[activeModal] : null
  const open = !!action
  const payload = modalPayload as { pageIds: string[] } | null

  const [value, setValue] = useState<string>('')
  const [appendNote, setAppendNote] = useState(true)
  const [running, setRunning] = useState(false)

  if (!open || !payload || !activeAccount) return null

  const pageIds = payload.pageIds
  const totalAffected = action === 'delete' ? getAffectedDeleteCount(tree, pageIds) : pageIds.length

  async function handleConfirm() {
    if (!action || !payload) return
    setRunning(true)
    await bulkOperation({
      action,
      page_ids: pageIds,
      value: value || undefined,
      append: appendNote,
      // @ts-expect-error account_id not in BulkOperationPayload type but API needs it
      account_id: activeAccount!.id,
    })
    clearSelection()
    closeModal()
    setValue('')
    setRunning(false)
  }

  const titles: Record<BulkAction, string> = {
    delete: 'מחיקה מרובה',
    change_status: 'שינוי סטטוס מרובה',
    change_template: 'שינוי תבנית מרובה',
    change_color: 'שינוי צבע מרובה',
    add_note: 'הוספת הערה מרובה',
    move: 'העברה מרובה',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{titles[action]}</h2>
          <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <p className="text-sm text-slate-600">
          {action === 'delete'
            ? <><strong className="text-red-600">{totalAffected} עמודים</strong> יימחקו (כולל ילדים).</>
            : <>{pageIds.length} עמודים נבחרו.</>
          }
        </p>

        {/* Value inputs per action */}
        {action === 'change_status' && (
          <select
            value={value}
            onChange={e => setValue(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">בחר סטטוס...</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        )}

        {action === 'change_template' && (
          <TemplateSelect value={value || null} onChange={v => setValue(v ?? '')} />
        )}

        {action === 'change_color' && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setValue('')}
              className={`w-6 h-6 rounded-full border-2 ${!value ? 'border-slate-800' : 'border-slate-200'} bg-white`}
              aria-label="ללא צבע"
            />
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setValue(c)}
                className={`w-6 h-6 rounded-full border-2 ${value === c ? 'border-slate-800 scale-110' : 'border-transparent'} transition-transform`}
                style={{ backgroundColor: c }}
                aria-label={`צבע ${c}`}
              />
            ))}
          </div>
        )}

        {action === 'add_note' && (
          <>
            <textarea
              value={value}
              onChange={e => setValue(e.target.value)}
              rows={3}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="הכנס הערה..."
            />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={appendNote} onChange={e => setAppendNote(e.target.checked)} />
              הוסף להערה הקיימת (לא מחק)
            </label>
          </>
        )}

        {action === 'move' && (
          <p className="text-sm text-slate-500">פעולה זו תעביר את כל הדפים לשורש. (Phase 6 implement full parent select)</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleConfirm}
            disabled={running}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              action === 'delete'
                ? 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300'
                : 'bg-slate-800 hover:bg-slate-700 text-white disabled:bg-slate-400'
            }`}
          >
            {running ? 'מבצע...' : 'אשר'}
          </button>
          <button type="button" onClick={closeModal} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
