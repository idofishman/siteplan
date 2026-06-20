'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ActivityEntry } from '@/types'

const ACTION_LABELS: Record<string, string> = {
  page_created: 'עמוד נוסף',
  page_updated: 'עמוד עודכן',
  page_deleted: 'עמוד נמחק',
  pages_bulk: 'עדכון קבוצתי',
  import_applied: 'ייבוא',
  snapshot_created: 'צלמית נוצרה',
  snapshot_restored: 'שחזור',
  snapshot_deleted: 'צלמית נמחקה',
  sitemap_cleared: 'מפה נמחקה',
  gsc_imported: 'GSC יובא',
}

function relativeHe(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return 'לפני פחות מדקה'
  if (diff < 3600) {
    const m = Math.floor(diff / 60)
    return `לפני ${m} ${m === 1 ? 'דקה' : 'דקות'}`
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600)
    return `לפני ${h} ${h === 1 ? 'שעה' : 'שעות'}`
  }
  const d = Math.floor(diff / 86400)
  return `לפני ${d} ${d === 1 ? 'יום' : 'ימים'}`
}

function exactHe(date: Date): string {
  return date.toLocaleString('he-IL', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function LastEdited({ accountId }: { accountId: string }) {
  const [latest, setLatest] = useState<ActivityEntry | null | undefined>(undefined)
  const [, tick] = useState(0)

  // Re-render every minute to update relative time
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!accountId) return
    const supabase = createClient()

    async function fetchLatest() {
      const { data } = await supabase
        .from('activity_log')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      setLatest(data ?? null)
    }

    fetchLatest()

    const channel = supabase
      .channel(`last-edited-${accountId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `account_id=eq.${accountId}` },
        (payload) => setLatest(payload.new as ActivityEntry)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [accountId])

  if (latest === undefined) return null

  if (!latest) {
    return (
      <span className="text-xs text-slate-400">אין עדכונים עדיין</span>
    )
  }

  const date = new Date(latest.created_at)
  const action = ACTION_LABELS[latest.action] ?? latest.action
  const tooltip = `${exactHe(date)} · ${action}`

  return (
    <span
      className="text-xs text-slate-400 cursor-default"
      title={tooltip}
    >
      עודכן {relativeHe(date)} על ידי {latest.user_name}
    </span>
  )
}
