'use client'

import { useState } from 'react'

interface Props {
  accountId: string
  accountName: string
  open: boolean
  onClose: () => void
  onCleared: () => void
}

export function ClearSitemapModal({ accountId, accountName, open, onClose, onCleared }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [confirmText, setConfirmText] = useState('')
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function handleClose() {
    setStep(1)
    setConfirmText('')
    setError(null)
    onClose()
  }

  async function handleClear() {
    setClearing(true)
    setError(null)

    const res = await fetch(`/api/admin/accounts/${accountId}?action=clear-sitemap`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm_token: 'DELETE', account_name: accountName }),
    })

    if (!res.ok) {
      const { error: e } = await res.json()
      setError(e ?? 'שגיאה בניקוי מפת האתר')
      setClearing(false)
      return
    }

    setClearing(false)
    handleClose()
    onCleared()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <h2 className="text-lg font-bold text-red-700">נקה מפת אתר</h2>
        </div>

        {step === 1 ? (
          <>
            <p className="text-sm text-slate-700">
              פעולה זו תמחק את <strong>כל העמודים</strong> בחשבון <strong>{accountName}</strong>.
              <br /><br />
              פעולה זו <strong>אינה הפיכה</strong>. מומלץ ליצור גיבוי לפני כן.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                המשך
              </button>
              <button onClick={handleClose} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
                ביטול
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-700">
              הקלד <strong>DELETE</strong> כדי לאשר את המחיקה.
            </p>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              dir="ltr"
              autoFocus
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleClear}
                disabled={confirmText !== 'DELETE' || clearing}
                className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {clearing ? 'מוחק...' : 'נקה מפת אתר לצמיתות'}
              </button>
              <button onClick={handleClose} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
                ביטול
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
