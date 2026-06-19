'use client'

import { useState, useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import { SnapshotCard } from './SnapshotCard'
import { SnapshotNameModal } from '@/components/modals/SnapshotNameModal'
import { SnapshotCompareModal } from '@/components/modals/SnapshotCompareModal'
import type { Snapshot } from '@/types'

interface Props {
  accountId: string
}

export function SnapshotList({ accountId }: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const { openModal } = useUiStore()
  const { loadPages } = useTreeStore()

  async function loadSnapshots() {
    const res = await fetch(`/api/snapshots?account_id=${accountId}`)
    if (res.ok) {
      const data = await res.json()
      setSnapshots(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadSnapshots()
  }, [accountId])

  async function handleDelete(id: string) {
    await fetch(`/api/snapshots/${id}`, { method: 'DELETE' })
    setSnapshots(prev => prev.filter(s => s.id !== id))
  }

  async function handleRestore(id: string) {
    if (!confirm('לשחזר גיבוי זה? המצב הנוכחי יישמר כגיבוי אוטומטי לפני השחזור.')) return
    const res = await fetch(`/api/snapshots/${id}/restore`, { method: 'POST' })
    if (res.ok) {
      await loadSnapshots()
      await loadPages(accountId)
    } else {
      const { error } = await res.json()
      alert('שגיאה בשחזור: ' + error)
    }
  }

  async function handleExport(id: string) {
    const res = await fetch(`/api/snapshots/${id}`)
    if (!res.ok) return
    const snapshot: Snapshot = await res.json()
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `snapshot-${snapshot.name.replace(/[^a-z0-9]/gi, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleCompare(id: string) {
    openModal('compareSnapshot', id)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-800">גיבויים ({snapshots.length})</h2>
        <button
          onClick={() => openModal('createSnapshot')}
          className="text-sm px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
        >
          + צור גיבוי
        </button>
      </div>

      {snapshots.length === 0 ? (
        <p className="text-center text-slate-400 py-12 text-sm">אין גיבויים עדיין</p>
      ) : (
        <div className="flex flex-col gap-3">
          {snapshots.map(s => (
            <SnapshotCard
              key={s.id}
              snapshot={s}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onCompare={handleCompare}
              onExport={handleExport}
            />
          ))}
        </div>
      )}

      <SnapshotNameModal onCreated={() => loadSnapshots()} />
      <SnapshotCompareModal />
    </div>
  )
}
