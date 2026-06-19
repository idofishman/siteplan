'use client'

import { useState } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useAccountStore } from '@/stores/accountStore'

interface Props {
  onCreated: (snapshotId: string) => void
}

export function SnapshotNameModal({ onCreated }: Props) {
  const { activeModal, closeModal } = useUiStore()
  const { activeAccount } = useAccountStore()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = activeModal === 'createSnapshot'

  if (!open || !activeAccount) return null

  async function handleCreate() {
    setCreating(true)
    setError(null)
    const res = await fetch('/api/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: activeAccount!.id, name }),
    })
    if (!res.ok) {
      const { error: e } = await res.json()
      setError(e ?? 'שגיאה ביצירת גיבוי')
      setCreating(false)
      return
    }
    const snapshot = await res.json()
    setCreating(false)
    setName('')
    closeModal()
    onCreated(snapshot.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800">צור גיבוי</h2>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">שם הגיבוי (אופציונלי)</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={`גיבוי ${new Date().toLocaleDateString('he-IL')}`}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {creating ? 'יוצר...' : 'צור גיבוי'}
          </button>
          <button onClick={closeModal} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
