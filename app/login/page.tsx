'use client'

import { useState, useTransition } from 'react'
import { signIn } from './actions'
import { SitemapAnimation } from '@/components/login/SitemapAnimation'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await signIn(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <main className="min-h-screen flex bg-slate-50" dir="rtl">
      {/* Animation panel — hidden on mobile */}
      <div className="hidden lg:flex flex-1 bg-slate-800 items-center justify-center p-10 relative overflow-hidden">
        {/* Subtle grid bg */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative z-10 w-full max-w-xl">
          <p className="text-slate-400 text-sm mb-6 text-center">מנהל מבנה האתר</p>
          <SitemapAnimation />
        </div>
      </div>

      {/* Login form panel */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8 flex flex-col gap-6">
          <h1 className="text-2xl font-bold text-center text-slate-800">
            כניסה למערכת
          </h1>

          <form action={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                אימייל
              </label>
              <input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                required
                autoComplete="email"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                סיסמה
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600 text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  מתחבר...
                </>
              ) : (
                'התחבר'
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
