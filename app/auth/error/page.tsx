'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function AuthErrorPage() {
  const params = useSearchParams()
  const reason = params.get('reason')

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold text-slate-800 mb-2">שגיאת אימות</h1>
        <p className="text-sm text-slate-500 mb-4">
          {reason === 'missing_params' ? 'הקישור אינו תקין.' : (reason ?? 'אירעה שגיאה. ייתכן שהקישור פג תוקף.')}
        </p>
        <Link href="/login" className="text-sm text-blue-600 underline">חזרה לכניסה</Link>
      </div>
    </div>
  )
}
