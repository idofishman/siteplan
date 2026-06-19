'use client'

import { useState, useEffect, useCallback } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { ActivityFilters } from './ActivityFilters'
import type { ActivityEntry } from '@/types'

interface Props {
  accountId: string
}

const ACTION_DESCRIPTIONS: Record<string, string> = {
  page_created: 'יצר עמוד',
  page_edited: 'ערך עמוד',
  page_deleted: 'מחק עמוד',
  page_moved: 'העביר עמוד',
  bulk_delete: 'מחק עמודים',
  bulk_change_status: 'שינה סטטוס',
  bulk_change_template: 'שינה תבנית',
  bulk_change_color: 'שינה צבע',
  bulk_add_note: 'הוסיף הערה',
  bulk_move: 'העביר עמודים',
  snapshot_created: 'יצר גיבוי',
  snapshot_restored: 'שחזר גיבוי',
  gsc_uploaded: 'העלה נתוני GSC',
  import_applied: 'ייבא מפה',
  sitemap_cleared: 'ניקה את המפה',
}

function relativeTime(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'לפני פחות מדקה'
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דקות`
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שעות`
  return `לפני ${Math.floor(diff / 86400)} ימים`
}

function absoluteTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('he-IL')
}

export function ActivityFeed({ accountId }: Props) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ userId: '', action: '', from: '', to: '' })

  const loadEntries = useCallback(async (pg: number, f: typeof filters) => {
    setLoading(true)
    const params = new URLSearchParams({ account_id: accountId, page: String(pg) })
    if (f.userId) params.set('user_id', f.userId)
    if (f.action) params.set('action', f.action)
    if (f.from) params.set('from', f.from)
    if (f.to) params.set('to', f.to)

    const res = await fetch(`/api/activity?${params}`)
    if (res.ok) {
      const data = await res.json()
      setEntries(prev => pg === 0 ? data.entries : [...prev, ...data.entries])
      setTotal(data.total)
      setHasMore(data.has_more)
    }
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    setPage(0)
    loadEntries(0, filters)
  }, [filters, accountId])

  function loadMore() {
    const next = page + 1
    setPage(next)
    loadEntries(next, filters)
  }

  return (
    <div>
      <ActivityFilters filters={filters} onChange={f => { setFilters(f); setPage(0) }} />

      <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">
        {total} פעולות
      </div>

      <div className="divide-y divide-slate-100">
        {entries.map(entry => (
          <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
            <Avatar name={entry.user_name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700">
                <span className="font-medium">{entry.user_name}</span>
                {' '}
                {ACTION_DESCRIPTIONS[entry.action] ?? entry.action}
                {entry.entity_name && (
                  <span className="text-slate-500"> — {entry.entity_name}</span>
                )}
              </p>
            </div>
            <span
              className="text-xs text-slate-400 whitespace-nowrap shrink-0"
              title={absoluteTime(entry.created_at)}
            >
              {relativeTime(entry.created_at)}
            </span>
          </div>
        ))}
      </div>

      {entries.length === 0 && !loading && (
        <p className="text-center text-slate-400 py-12 text-sm">אין פעולות להצגה</p>
      )}

      {hasMore && (
        <div className="px-4 py-3 border-t border-slate-100">
          <button
            onClick={loadMore}
            disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:text-slate-400"
          >
            {loading ? 'טוען...' : 'טען עוד'}
          </button>
        </div>
      )}
    </div>
  )
}
