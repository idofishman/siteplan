'use client'

import { useRef, useState } from 'react'
import { useAccountStore } from '@/stores/accountStore'
import { useTreeStore } from '@/stores/treeStore'

const PERIODS = [
  { value: '28d', label: '28 ימים' },
  { value: '1m', label: 'חודש' },
  { value: '3m', label: '3 חודשים' },
  { value: '6m', label: '6 חודשים' },
  { value: '1y', label: 'שנה' },
]

export function GscUpload() {
  const { activeAccount } = useAccountStore()
  const { loadGsc } = useTreeStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [period, setPeriod] = useState('3m')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ inserted: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    if (!activeAccount) return
    setUploading(true)
    setError(null)
    setResult(null)

    const fd = new FormData()
    fd.append('account_id', activeAccount.id)
    fd.append('period', period)
    fd.append('file', file)

    const res = await fetch('/api/gsc', { method: 'POST', body: fd })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'שגיאה בהעלאת קובץ')
    } else {
      setResult(data)
      await loadGsc(activeAccount.id)
    }
    setUploading(false)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="font-medium text-slate-800 mb-1 text-sm">העלאת נתוני GSC</h3>
      <p className="text-xs text-slate-400 mb-3">קובץ CSV מ-Google Search Console עם עמודות: page, clicks (וגם: impressions, ctr, position)</p>

      <div className="flex items-center gap-3 mb-3">
        <label className="text-sm text-slate-600 shrink-0">תקופת נתונים:</label>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PERIODS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div
        className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-lg p-6 text-center cursor-pointer transition-colors"
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
          accept=".csv,text/csv"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
            <span className="text-sm text-slate-500">מעלה...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl">📂</span>
            <span className="text-sm text-slate-600">גרור קובץ CSV לכאן או לחץ לבחירה</span>
          </div>
        )}
      </div>

      {result && (
        <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          ✓ נטענו {result.inserted} רשומות בהצלחה
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
