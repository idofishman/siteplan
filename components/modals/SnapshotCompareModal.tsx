'use client'

import { useState, useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Page, Snapshot } from '@/types'

type DiffStatus = 'unchanged' | 'changed' | 'deleted' | 'added'

interface PageDiff {
  page: Page
  diffStatus: DiffStatus
  changedFields?: string[]
}

function buildDiff(snapshotPages: Page[], currentPages: Page[]): PageDiff[] {
  const snapshotMap = new Map(snapshotPages.map(p => [p.url_normalized ?? p.id, p]))
  const currentMap = new Map(currentPages.map(p => [p.url_normalized ?? p.id, p]))
  const result: PageDiff[] = []

  // Pages in snapshot
  for (const [key, sp] of snapshotMap) {
    const cp = currentMap.get(key)
    if (!cp) {
      result.push({ page: sp, diffStatus: 'deleted' })
    } else {
      const changedFields: string[] = []
      for (const field of ['name', 'status', 'url', 'template', 'color', 'notes'] as (keyof Page)[]) {
        if (sp[field] !== cp[field]) changedFields.push(field as string)
      }
      result.push({
        page: sp,
        diffStatus: changedFields.length > 0 ? 'changed' : 'unchanged',
        changedFields,
      })
    }
  }

  // Pages in current but not in snapshot
  for (const [key, cp] of currentMap) {
    if (!snapshotMap.has(key)) {
      result.push({ page: cp, diffStatus: 'added' })
    }
  }

  return result
}

const DIFF_COLORS: Record<DiffStatus, string> = {
  unchanged: 'bg-white',
  changed: 'bg-yellow-50 border-l-4 border-yellow-400',
  deleted: 'bg-red-50 border-l-4 border-red-400',
  added: 'bg-green-50 border-l-4 border-green-400',
}

const DIFF_LABELS: Record<DiffStatus, string> = {
  unchanged: '',
  changed: 'שונה',
  deleted: 'נמחק',
  added: 'חדש',
}

export function SnapshotCompareModal() {
  const { activeModal, modalPayload, closeModal } = useUiStore()
  const { pages: currentPages } = useTreeStore()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(false)

  const open = activeModal === 'compareSnapshot'
  const snapshotId = (modalPayload as string) ?? null

  useEffect(() => {
    if (open && snapshotId) {
      setLoading(true)
      fetch(`/api/snapshots/${snapshotId}`)
        .then(r => r.json())
        .then(s => { setSnapshot(s); setLoading(false) })
    }
  }, [open, snapshotId])

  if (!open) return null

  const diffs = snapshot ? buildDiff(snapshot.data ?? [], currentPages) : []
  const changed = diffs.filter(d => d.diffStatus !== 'unchanged').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">השוואת גיבוי</h2>
            {snapshot && <p className="text-sm text-slate-500">{snapshot.name} vs מצב נוכחי</p>}
          </div>
          <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-sm text-slate-500 shrink-0">
              {changed} שינויים מתוך {diffs.length} עמודים
            </div>
            <div className="overflow-y-auto flex-1">
              {diffs.filter(d => d.diffStatus !== 'unchanged').map((diff, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-2 border-b border-slate-100 ${DIFF_COLORS[diff.diffStatus]}`}>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    diff.diffStatus === 'added' ? 'bg-green-100 text-green-700' :
                    diff.diffStatus === 'deleted' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {DIFF_LABELS[diff.diffStatus]}
                  </span>
                  <span className="text-sm text-slate-700 flex-1">{diff.page.name}</span>
                  {diff.page.url && <span className="text-xs text-slate-400 dir-ltr" dir="ltr">{diff.page.url}</span>}
                  <StatusBadge status={diff.page.status} size="xs" />
                  {diff.changedFields && diff.changedFields.length > 0 && (
                    <span className="text-xs text-slate-400">({diff.changedFields.join(', ')})</span>
                  )}
                </div>
              ))}
              {diffs.filter(d => d.diffStatus !== 'unchanged').length === 0 && (
                <p className="text-center text-slate-400 py-12 text-sm">אין שינויים</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
