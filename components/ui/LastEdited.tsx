'use client'

import { useEffect, useState } from 'react'
import { useTreeStore } from '@/stores/treeStore'

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

export function LastEdited({ accountId: _ }: { accountId: string }) {
  const { pages, profilesMap } = useTreeStore()
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const latest = pages
    .filter(p => p.updated_at)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null

  if (!latest) return null

  const date = new Date(latest.updated_at)
  const editorName = latest.updated_by ? (profilesMap[latest.updated_by] ?? null) : null
  const tooltip = `${latest.name} · ${exactHe(date)}`

  return (
    <span className="text-xs text-slate-400 cursor-default" title={tooltip}>
      עודכן {relativeHe(date)}{editorName ? ` על ידי ${editorName}` : ''}
    </span>
  )
}
