'use client'

import { useState } from 'react'
import type { Snapshot } from '@/types'

interface Props {
  snapshot: Snapshot
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onCompare: (id: string) => void
  onExport: (id: string) => void
}

export function SnapshotCard({ snapshot, onDelete, onRestore, onCompare, onExport }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isAutoBackup = snapshot.name.startsWith('גיבוי לפני')

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            {isAutoBackup && <span title="גיבוי אוטומטי" className="text-base">🔒</span>}
            <p className="font-medium text-slate-800 text-sm">{snapshot.name}</p>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {snapshot.page_count} עמודים · {snapshot.created_by_name} · {new Date(snapshot.created_at).toLocaleString('he-IL')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => onRestore(snapshot.id)} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">
          שחזר
        </button>
        <button onClick={() => onCompare(snapshot.id)} className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors">
          השווה
        </button>
        <button onClick={() => onExport(snapshot.id)} className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors">
          ייצוא JSON
        </button>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 transition-colors">
            מחק
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={() => onDelete(snapshot.id)} className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white">
              אשר מחיקה
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1.5 text-slate-500 hover:text-slate-700">
              ביטול
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
