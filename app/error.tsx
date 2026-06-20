'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-700">
      <p className="text-lg font-medium">משהו השתבש</p>
      <p className="text-sm text-slate-400">{error.message}</p>
      <button
        onClick={reset}
        className="text-sm px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
      >
        נסה שוב
      </button>
    </div>
  )
}
