'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import { useAccountStore } from '@/stores/accountStore'
import { TemplateSelect } from '@/components/ui/TemplateSelect'
import { COLORS, STATUS_LABELS } from '@/lib/constants'
import type { Page, PageStatus } from '@/types'

const STATUSES: PageStatus[] = ['planned', 'existing', 'in_progress', 'needs_review', 'approved', 'deprecated', 'redirect', 'archived']
const NEW_SITE_BASE = 'https://new.colman.ac.il'

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

function buildNewUrlPath(pages: Page[], parentId: string | null, slug: string): string {
  const parts: string[] = []
  let id = parentId
  while (id) {
    const p = pages.find(x => x.id === id)
    if (!p) break
    if (p.new_url) parts.unshift(p.new_url.replace(/^\/+|\/+$/g, ''))
    id = p.parent_id
  }
  const cleanSlug = slug.trim().replace(/^\/+|\/+$/g, '')
  if (cleanSlug) parts.push(cleanSlug)
  return parts.filter(Boolean).join('/')
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

function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
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
  const [newUrlSlug, setNewUrlSlug] = useState('')
  const [status, setStatus] = useState<PageStatus>('planned')
  const [color, setColor] = useState<string | null>(null)
  const [template, setTemplate] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [needsContentUpdate, setNeedsContentUpdate] = useState(false)
  const [contentUpdateNotes, setContentUpdateNotes] = useState('')
  const [isLiveOnNewSite, setIsLiveOnNewSite] = useState(false)
  const [newSiteLiveAt, setNewSiteLiveAt] = useState<string | null>(null)
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(page?.name ?? '')
      setUrl(page?.url ?? '')
      setNewUrlSlug(page?.new_url ?? '')
      setStatus(page?.status ?? 'planned')
      setColor(page?.color ?? null)
      setTemplate(page?.template ?? null)
      setNotes(page?.notes ?? '')
      setIsVerified(page?.is_verified ?? false)
      setNeedsContentUpdate(page?.needs_content_update ?? false)
      setContentUpdateNotes(page?.content_update_notes ?? '')
      setNewSiteLiveAt(page?.new_site_live_at ?? null)
      setIsLiveOnNewSite(!!(page?.new_site_live_at))
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

  // Compute the full new URL path from parent chain + current slug
  const newUrlPath = useMemo(
    () => buildNewUrlPath(pages, selectedParentId, newUrlSlug),
    [pages, selectedParentId, newUrlSlug]
  )
  const fullNewUrl = newUrlPath ? `${NEW_SITE_BASE}/${newUrlPath}/` : null

  function handleLiveToggle(checked: boolean) {
    setIsLiveOnNewSite(checked)
    if (checked && !newSiteLiveAt) {
      setNewSiteLiveAt(new Date().toISOString())
    } else if (!checked) {
      setNewSiteLiveAt(null)
    }
  }

  if (!open || !activeAccount) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('שם העמוד הוא שדה חובה'); return }
    if (!url.trim()) { setError('כתובת URL היא שדה חובה'); return }
    setSaving(true)
    setError(null)

    const slugClean = newUrlSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || null

    try {
      if (isEdit && page) {
        await updatePage(page.id, {
          name: name.trim(),
          url: url.trim() || null,
          new_url: slugClean,
          status,
          color,
          template,
          notes: notes.trim() || null,
          is_verified: isVerified,
          needs_content_update: needsContentUpdate,
          content_update_notes: needsContentUpdate ? (contentUpdateNotes.trim() || null) : null,
          new_site_live_at: isLiveOnNewSite ? (newSiteLiveAt ?? new Date().toISOString()) : null,
          parent_id: selectedParentId,
        })
      } else {
        await addPage({
          account_id: activeAccount!.id,
          parent_id: selectedParentId,
          name: name.trim(),
          url: url.trim() || null,
          new_url: slugClean,
          status,
          color,
          template,
          notes: notes.trim() || null,
          is_verified: isVerified,
          needs_content_update: needsContentUpdate,
          content_update_notes: needsContentUpdate ? (contentUpdateNotes.trim() || null) : null,
          new_site_live_at: isLiveOnNewSite ? (newSiteLiveAt ?? new Date().toISOString()) : null,
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

        {/* Current URL */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">כתובת URL נוכחית *</label>
          <div className="flex items-center gap-1.5">
            <input
              dir="ltr"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="/about"
            />
            {url && (
              <a
                href={url.startsWith('http') ? url : `https://www.colman.ac.il${url.startsWith('/') ? '' : '/'}${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-slate-400 hover:text-blue-500 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                title="פתח באתר הנוכחי"
                onClick={e => e.stopPropagation()}
              >
                <EyeIcon />
              </a>
            )}
          </div>
        </div>

        {/* New URL slug */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            Slug באתר החדש
            <span className="text-[10px] font-normal text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5">new.colman.ac.il</span>
          </label>
          <div className="flex items-center gap-1.5">
            <input
              dir="ltr"
              value={newUrlSlug}
              onChange={e => setNewUrlSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-'))}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              placeholder="slug-here"
            />
            {fullNewUrl && (
              <a
                href={fullNewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-slate-400 hover:text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                title={`פתח באתר החדש: ${fullNewUrl}`}
                onClick={e => e.stopPropagation()}
              >
                <EyeIcon />
              </a>
            )}
          </div>
          {fullNewUrl && (
            <p className="text-[11px] text-slate-400 font-mono truncate" dir="ltr" title={fullNewUrl}>
              {fullNewUrl}
            </p>
          )}
        </div>

        {/* Live on new site */}
        <div className="flex flex-col gap-1.5 border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isLiveOnNewSite}
              onChange={e => handleLiveToggle(e.target.checked)}
              className="w-4 h-4 rounded accent-amber-500"
            />
            <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              פעיל באתר החדש
            </span>
            {isLiveOnNewSite && newSiteLiveAt && (
              <span className="text-xs text-slate-400 mr-auto">
                {new Date(newSiteLiveAt).toLocaleDateString('he-IL')}
              </span>
            )}
          </label>
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

        {/* Needs content update */}
        <div className={`flex flex-col gap-2 border rounded-lg px-3 py-2.5 transition-colors ${needsContentUpdate ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-slate-50'}`}>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={needsContentUpdate}
              onChange={e => setNeedsContentUpdate(e.target.checked)}
              className="w-4 h-4 rounded accent-orange-500"
            />
            <span className="text-sm font-medium text-slate-700">האם נדרשים עדכוני תוכן?</span>
            {needsContentUpdate && (
              <span className="text-[10px] font-medium text-orange-700 bg-orange-200 rounded-full px-1.5 py-0.5 mr-auto">נדרש עדכון</span>
            )}
          </label>
          {needsContentUpdate && (
            <textarea
              value={contentUpdateNotes}
              onChange={e => setContentUpdateNotes(e.target.value)}
              rows={3}
              dir="rtl"
              placeholder="פרט מה צריך לעדכן בתוכן העמוד..."
              className="border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-y bg-white"
            />
          )}
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
