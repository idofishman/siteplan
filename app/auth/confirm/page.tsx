'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

function ConfirmContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type') as 'invite' | 'recovery' | null

    if (!token_hash || !type) {
      setError('קישור לא תקין')
      return
    }

    const supabase = createClient()
    supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
      if (error) {
        setError(error.message)
        return
      }
      // Session is now stored in browser cookies by the JS client.
      // Invite → app, recovery → set new password.
      router.replace(type === 'recovery' ? '/auth/update-password' : '/app')
    })
  }, [searchParams, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-slate-800 mb-2">שגיאת אימות</h1>
          <p className="text-sm text-slate-500 mb-4">{error}</p>
          <p className="text-xs text-slate-400">ייתכן שהקישור פג תוקף. בקש קישור חדש מהמנהל.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">מאמת את הקישור...</p>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmContent />
    </Suspense>
  )
}
