'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import { useAccountStore } from '@/stores/accountStore'
import { TemplateSelect } from '@/components/ui/TemplateSelect'
import { COLORS, STATUS_LABELS } from '@/lib/constants'
import type { Page, PageStatus } from '@/types'

const STATUSES: PageStatus[] = ['planned', 'existing', 'in_progress', 'needs_review', 'approved', 'deprecated', 'redirect', 'archived']

function getDescendantIdsFlat(pages: Page[], rootId: string): Set<string> {
  const result = new Set<string>()
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    for (const p of pages) {
      if (p.parent_id === id) { result.add(p.id); stack.push(p.id) }
    }
  }
  return result
}

interface ParentPickerProps {
  options: Page[]
  value: string | null
  onChange: (id: string | null) => void
}

function ParentPicker({ options, value, onChange }: ParentPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find(p => p.id === value) ?? null
  const displayLabel = selected ? selected.name : '— ללא עמוד אב (שורש) —'

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(p =>
      p.name.toLowerCase().includes(q) || (p.url ?? '').toLowerCase().includes(q)
    )
  }, [options, query])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function select(id: string | null) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full text-right border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white flex items-center justify-between gap-2"
      >
        <span className={`truncate ${!selected ? 'text-slate-400' : 'text-slate-800'}`}>{displayLabel}</span>
        <svg className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg flex flex-col overflow-hidden max-h-60">
          <div className="p-2 border-b border-slate-100 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="חיפוש..."
              className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              dir="rtl"
            />
          </div>
          <div className="overflow-y-auto">
            <button
              type="button"
              onClick={() => select(null)}
              className={`w-full text-right px-3 py-2 text-sm hover:bg-slate-50 ${!value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500'}`}
            >
              — ללא עמוד אב (שורש) —
            </button>
            {filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => select(p.id)}
                className={`w-full text-right px-3 py-2 text-sm hover:bg-slate-50 flex flex-col gap-0.5 ${value === p.id ? 'bg-blue-50' : ''}`}
              >
                <span className={`font-medium truncate ${value === p.id ? 'text-blue-700' : 'text-slate-800'}`}>{p.name}</span>
                {p.url && <span className="text-xs text-slate-400 truncate" dir="ltr">{p.url}</span>}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-sm text-slate-400 text-center">לא נמצאו תוצאות</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function AddEditPageModal() {
  const { activeModal, modalPayload, closeModal } = useUiStore()
  const { addPage, updatePage, pages } = useTreeStore()
  const { activeAccount } = useAccountStore()

  const isEdit = activeModal === 'editPage'
  const isAdd = activeModal === 'addPage'
  const open = isEdit || isAdd

  const page = (isEdit ? modalPayload : null) as Page | null
  const addParentId = (isAdd ? (modalPayload as { parentId?: string })?.parentId : null) ?? null

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<PageStatus>('planned')
  const [color, setColor] = useState<string | null>(null)
  const [template, setTemplate] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
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
      setIsVerified(page?.is_verified ?? false)
      setSelectedParentId(isEdit ? (page?.parent_id ?? null) : addParentId)
      setError(null)
    }
  }, [open, page?.id])

  // Pages available as parent: exclude self and its descendants
  const parentOptions = useMemo(() => {
    if (!page) return pages.filter(p => !p.is_deleted)
    const forbidden = new Set([page.id, ...getDescendantIdsFlat(pages, page.id)])
    return pages.filter(p => !forbidden.has(p.id) && !p.is_deleted)
  }, [pages, page?.id])

  // All colors: standard palette + any colors already in use in this sitemap
  const allColors = useMemo(() => {
    const inUse = pages.map(p => p.color).filter((c): c is string => !!c)
    return [...new Set([...COLORS, ...inUse])]
  }, [pages])

  if (!open || !activeAccount) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('שם העמוד הוא שדה חובה'); return }
    if (!url.trim()) { setError('כתובת URL היא שדה חובה'); return }
    setSaving(true)
    setError(null)

    try {
      if (isEdit && page) {
        await updatePage(page.id, {
          name: name.trim(),
          url: url.trim() || null,
          status,
          color,
          template,
          notes: notes.trim() || null,
          is_verified: isVerified,
          parent_id: selectedParentId,
        })
      } else {
        await addPage({
          account_id: activeAccount!.id,
          parent_id: selectedParentId,
          name: name.trim(),
          url: url.trim() || null,
          status,
          color,
          template,
          notes: notes.trim() || null,
          is_verified: isVerified,
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
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
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

        {/* Parent Page */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">עמוד אב</label>
          <ParentPicker options={parentOptions} value={selectedParentId} onChange={setSelectedParentId} />
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
            {allColors.map(c => (
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

        {/* Mark Completed */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isVerified}
            onChange={e => setIsVerified(e.target.checked)}
            className="w-4 h-4 rounded accent-emerald-600"
          />
          <span className="text-sm font-medium text-slate-700">סמן כמאושר ✓</span>
          {isVerified && <span className="text-xs text-emerald-600">העמוד מאושר</span>}
        </label>

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
