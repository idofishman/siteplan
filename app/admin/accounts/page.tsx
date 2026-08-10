'use client'

import { useState, useEffect } from 'react'
import { ClearSitemapModal } from '@/components/modals/ClearSitemapModal'

const PAGE_SIZE = 20

interface AccountRow {
  id: string
  name: string
  domain: string | null
  is_active: boolean
  created_at: string
}

interface SlugPreviewRow {
  id: string
  name: string
  current_url: string | null
  existing_slug: string | null
  generated_slug: string | null
  would_update: boolean
}

interface SlugPreviewModalProps {
  account: AccountRow
  onClose: () => void
  onApplied: (summary: string) => void
}

function SlugPreviewModal({ account, onClose, onApplied }: SlugPreviewModalProps) {
  const [rows, setRows] = useState<SlugPreviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [applying, setApplying] = useState(false)
  const [filter, setFilter] = useState<'all' | 'to_update' | 'has_slug'>('to_update')
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  async function handleSlugEdit(rowId: string, value: string) {
    const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (!clean) return
    setSaving(s => ({ ...s, [rowId]: true }))
    const res = await fetch(`/api/pages/${rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_url: clean }),
    })
    setSaving(s => ({ ...s, [rowId]: false }))
    if (res.ok) {
      setRows(prev => prev.map(r => r.id === rowId
        ? { ...r, existing_slug: clean, generated_slug: clean, would_update: false }
        : r
      ))
      setSavedIds(s => new Set(s).add(rowId))
    }
  }

  useEffect(() => {
    fetch(`/api/admin/generate-slugs?account_id=${account.id}`)
      .then(r => r.json())
      .then(d => { setRows(d.preview ?? []); setLoading(false) })
  }, [account.id])

  const filtered = rows.filter(r => {
    if (filter === 'to_update') return r.would_update
    if (filter === 'has_slug') return !r.would_update
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const slice = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const toUpdateCount = rows.filter(r => r.would_update).length
  const hasSlugCount = rows.filter(r => !r.would_update).length

  async function handleApply() {
    if (!confirm(`פעולה זו תיצור גיבוי ותמלא slugs ל-${toUpdateCount} עמודים. להמשיך?`)) return
    setApplying(true)
    const res = await fetch('/api/admin/generate-slugs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: account.id }),
    })
    const data = await res.json()
    setApplying(false)
    if (res.ok) {
      onApplied(`✓ גיבוי נוצר | עודכנו: ${data.updated} | דולגו: ${data.skipped}`)
      onClose()
    } else {
      alert(`שגיאה: ${data.error}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">תצוגה מקדימה — Slugs אוטומטיים</h2>
            <p className="text-sm text-slate-500 mt-0.5">{account.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        {/* Summary bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-4 shrink-0 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setFilter('to_update'); setPage(0) }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filter === 'to_update' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              ימולאו ({toUpdateCount})
            </button>
            <button
              onClick={() => { setFilter('has_slug'); setPage(0) }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filter === 'has_slug' ? 'bg-slate-700 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              כבר יש Slug ({hasSlugCount})
            </button>
            <button
              onClick={() => { setFilter('all'); setPage(0) }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filter === 'all' ? 'bg-slate-700 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              הכל ({rows.length})
            </button>
          </div>
          <span className="text-xs text-slate-400 mr-auto">
            עמוד {page + 1} מתוך {totalPages || 1} · {filtered.length} רשומות
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
                <tr>
                  <th className="text-start px-4 py-2.5 text-xs font-medium text-slate-500 w-8">#</th>
                  <th className="text-start px-4 py-2.5 text-xs font-medium text-slate-500">שם עמוד</th>
                  <th className="text-start px-4 py-2.5 text-xs font-medium text-slate-500">כתובת נוכחית</th>
                  <th className="text-start px-4 py-2.5 text-xs font-medium text-slate-500">Slug שיווצר</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((row, i) => {
                  const currentSlug = row.existing_slug ?? row.generated_slug ?? ''
                  const isSaving = saving[row.id]
                  const isSaved = savedIds.has(row.id)
                  return (
                    <tr key={row.id} className={`border-b border-slate-100 ${row.would_update && !isSaved ? '' : 'bg-slate-50'}`}>
                      <td className="px-4 py-2 text-xs text-slate-400 tabular-nums">{page * PAGE_SIZE + i + 1}</td>
                      <td className="px-4 py-2 text-slate-800 font-medium max-w-[200px] truncate" title={row.name}>{row.name}</td>
                      <td className="px-4 py-2 text-slate-400 font-mono text-xs max-w-[280px] truncate" dir="ltr" title={row.current_url ?? ''}>
                        {row.current_url ?? '—'}
                      </td>
                      <td className="px-4 py-2 min-w-[180px]">
                        <div className="flex items-center gap-1.5">
                          <input
                            key={currentSlug}
                            defaultValue={currentSlug}
                            dir="ltr"
                            className={`font-mono text-xs px-2 py-0.5 rounded border w-full focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
                              isSaved ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
                              row.would_update ? 'border-slate-200 bg-white text-slate-700' :
                              'border-slate-200 bg-slate-50 text-slate-500'
                            }`}
                            onBlur={e => { if (e.target.value !== currentSlug) handleSlugEdit(row.id, e.target.value) }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
                          />
                          {isSaving && <span className="text-slate-400 text-xs shrink-0">...</span>}
                          {isSaved && !isSaving && <span className="text-emerald-500 text-xs shrink-0">✓</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {slice.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-400 text-sm">אין רשומות להצגה</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer — pagination + apply */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← הקודם
            </button>
            <span className="text-sm text-slate-500 tabular-nums">{page + 1} / {totalPages || 1}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              הבא →
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
              ביטול
            </button>
            <button
              onClick={handleApply}
              disabled={applying || toUpdateCount === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {applying ? 'מיישם...' : `הפעל על ${toUpdateCount} עמודים`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [clearTarget, setClearTarget] = useState<AccountRow | null>(null)
  const [previewTarget, setPreviewTarget] = useState<AccountRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDomain, setNewDomain] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [slugResult, setSlugResult] = useState<Record<string, string>>({})

  async function load() {
    const res = await fetch('/api/admin/accounts')
    if (res.ok) setAccounts(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleToggleStatus(account: AccountRow) {
    const nextActive = !account.is_active
    await fetch(`/api/admin/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: nextActive }),
    })
    setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, is_active: nextActive } : a))
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    setCreateError(null)
    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, domain: newDomain }),
    })
    if (res.ok) {
      const acc = await res.json()
      setAccounts(prev => [acc, ...prev])
      setNewName('')
      setNewDomain('')
    } else {
      const { error } = await res.json()
      setCreateError(error ?? 'שגיאה ביצירת חשבון')
    }
    setCreating(false)
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-6">חשבונות ({accounts.length})</h1>

        {/* Create account */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">שם חשבון</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="שם החברה"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">דומיין (אופציונלי)</label>
            <input
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              placeholder="example.com"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              dir="ltr"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {creating ? 'יוצר...' : 'צור חשבון'}
          </button>
          {createError && <p className="text-sm text-red-600 w-full">{createError}</p>}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">שם</th>
                <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">דומיין</th>
                <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">סטטוס</th>
                <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">נוצר</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{a.name}</td>
                  <td className="px-4 py-3 text-slate-500" dir="ltr">{a.domain ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleStatus(a)}
                      className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                        a.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {a.is_active ? 'פעיל' : 'לא פעיל'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(a.created_at).toLocaleDateString('he-IL')}</td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => setPreviewTarget(a)}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                      >
                        תצוגה מקדימה — Slugs
                      </button>
                      {slugResult[a.id] && (
                        <span className="text-[11px] text-slate-500">{slugResult[a.id]}</span>
                      )}
                      <button
                        onClick={() => setClearTarget(a)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        נקה מפת אתר
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {clearTarget && (
        <ClearSitemapModal
          accountId={clearTarget.id}
          accountName={clearTarget.name}
          open={!!clearTarget}
          onClose={() => setClearTarget(null)}
          onCleared={() => setClearTarget(null)}
        />
      )}

      {previewTarget && (
        <SlugPreviewModal
          account={previewTarget}
          onClose={() => setPreviewTarget(null)}
          onApplied={(summary) => {
            setSlugResult(prev => ({ ...prev, [previewTarget.id]: summary }))
            setPreviewTarget(null)
          }}
        />
      )}
    </div>
  )
}
