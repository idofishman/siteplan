'use client'

import { useRef, useState } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useAccountStore } from '@/stores/accountStore'
import type { ImportPlan } from '@/lib/utils/importEngine'

interface Props {
  onPlanReady: (plan: ImportPlan) => void
}

export function ImportModal({ onPlanReady }: Props) {
  const { activeModal, closeModal, openModal } = useUiStore()
  const { activeAccount } = useAccountStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = activeModal === 'import'

  if (!open || !activeAccount) return null

  async function handleFile(file: File) {
    setAnalyzing(true)
    setError(null)

    const fd = new FormData()
    fd.append('account_id', activeAccount!.id)
    fd.append('file', file)

    const res = await fetch('/api/import/analyze', { method: 'POST', body: fd })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'שגיאה בניתוח הקובץ')
      setAnalyzing(false)
      return
    }

    setAnalyzing(false)
    closeModal()
    onPlanReady(data.plan)
    openModal('importPreview', data.plan)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800">ייבוא מפת אתר</h2>
        <p className="text-sm text-slate-500">תמיכה בפורמטים: XML Sitemap, רשימת URL (TXT), CSV</p>

        <div
          className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl p-8 text-center cursor-pointer transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f) handleFile(f)
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xml,.txt,.csv,text/plain,text/csv,application/xml,text/xml"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />
          {analyzing ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
              <span className="text-sm text-slate-500">מנתח קובץ...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl">📋</span>
              <span className="text-sm text-slate-600">גרור קובץ לכאן או לחץ לבחירה</span>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <button onClick={closeModal} className="text-sm text-slate-500 hover:text-slate-700 self-start">ביטול</button>
      </div>
    </div>
  )
}
