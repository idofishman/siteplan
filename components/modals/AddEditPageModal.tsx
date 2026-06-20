'use client'

import { useState, useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import { useAccountStore } from '@/stores/accountStore'
import { TemplateSelect } from '@/components/ui/TemplateSelect'
import { COLORS, STATUS_LABELS } from '@/lib/constants'
import type { Page, PageStatus } from '@/types'

const STATUSES: PageStatus[] = ['planned', 'existing', 'in_progress', 'needs_review', 'approved', 'deprecated', 'redirect', 'archived']

export function AddEditPageModal() {
  const { activeModal, modalPayload, closeModal } = useUiStore()
  const { addPage, updatePage } = useTreeStore()
  const { activeAccount } = useAccountStore()

  const isEdit = activeModal === 'editPage'
  const isAdd = activeModal === 'addPage'
  const open = isEdit || isAdd

  const page = (isEdit ? modalPayload : null) as Page | null
  const parentId = (isAdd ? (modalPayload as { parentId?: string })?.parentId : null) ?? null

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<PageStatus>('planned')
  const [color, setColor] = useState<string | null>(null)
  const [template, setTemplate] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(page?.name ?? '')
      setUrl(page?.url ?? '')
      setStatus(page?.status ?? 'planned')
      setColor(page?.color ?? null)
      setTemplate(page?.template ?? null)
      setNotes(page?.notes ?? '')
      setError(null)
    }
  }, [open, page?.id])

  if (!open || !activeAccount) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('שם העמוד הוא שדה חובה'); return }
    if (!url.trim()) { setError('כתובת URL היא שדה חובה'); return }
    setSaving(true)
    setError(null)

    try {
      if (isEdit && page) {
        await updatePage(page.id, { name: name.trim(), url: url.trim() || null, status, color, template, notes: notes.trim() || null })
      } else {
        await addPage({
          account_id: activeAccount!.id,
          parent_id: parentId,
          name: name.trim(),
          url: url.trim() || null,
          status,
          color,
          template,
          notes: notes.trim() || null,
          sort_order: 0,
        })
      }
      closeModal()
    } catch {
      setError('שגיאה בשמירה, נסה שוב')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {isEdit ? 'עריכת עמוד' : 'הוספת עמוד חדש'}
          </h2>
          <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">שם העמוד *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            placeholder="שם העמוד"
            autoFocus
          />
        </div>

        {/* URL */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">כתובת URL *</label>
          <input
            dir="ltr"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            placeholder="/about"
          />
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">סטטוס</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as PageStatus)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {/* Template */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">תבנית</label>
          <TemplateSelect value={template} onChange={setTemplate} />
        </div>

        {/* Color */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">צבע</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setColor(null)}
              className={`w-6 h-6 rounded-full border-2 ${!color ? 'border-slate-800' : 'border-slate-200'} bg-white`}
              aria-label="ללא צבע"
            />
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-slate-800 scale-110' : 'border-transparent'} transition-transform`}
                style={{ backgroundColor: c }}
                aria-label={`צבע ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">הערות</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 justify-start pt-1">
          <button
            type="submit"
            disabled={saving}
            className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'שומר...' : isEdit ? 'שמור שינויים' : 'הוסף עמוד'}
          </button>
          <button type="button" onClick={closeModal} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
            ביטול
          </button>
        </div>
      </form>
    </div>
  )
}
