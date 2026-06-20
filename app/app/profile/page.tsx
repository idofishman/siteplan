'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Profile {
  id: string
  display_name: string
  email: string
  role: string
  created_at: string
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : null)
      .then(me => {
        if (me) { setProfile(me); setDisplayName(me.display_name) }
      })
  }, [])

  async function handleSave() {
    if (!profile || !displayName.trim()) return
    setSaving(true)
    setSaved(false)
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName }),
    })
    setSaving(false)
    if (res.ok) setSaved(true)
  }

  async function handleResetPassword() {
    if (!profile) return
    setResetStatus('loading')
    const res = await fetch(`/api/admin/users/${profile.id}?action=reset-password`, { method: 'PATCH' })
    if (res.ok) {
      const { link } = await res.json()
      if (link) {
        await navigator.clipboard.writeText(link).catch(() => {})
        setResetStatus('sent')
      }
    } else {
      setResetStatus('error')
    }
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/app" className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-semibold text-slate-800">הפרופיל שלי</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {/* Avatar initial */}
        <div className="px-6 py-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center text-xl font-semibold shrink-0">
            {profile.display_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-slate-800">{profile.display_name}</div>
            <div className="text-sm text-slate-500" dir="ltr">{profile.email}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {profile.role === 'system_admin' ? 'מנהל מערכת' : 'משתמש'}
            </div>
          </div>
        </div>

        {/* Edit display name */}
        <div className="px-6 py-5 space-y-3">
          <label className="block text-sm font-medium text-slate-700">שם תצוגה</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setSaved(false) }}
              className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="שם תצוגה"
            />
            <button
              onClick={handleSave}
              disabled={saving || !displayName.trim() || displayName === profile.display_name}
              className="text-sm px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors disabled:opacity-50 shrink-0"
            >
              {saving ? 'שומר...' : saved ? 'נשמר ✓' : 'שמור'}
            </button>
          </div>
        </div>

        {/* Email */}
        <div className="px-6 py-5 space-y-1">
          <div className="text-sm font-medium text-slate-700">כתובת אימייל</div>
          <div className="text-sm text-slate-500" dir="ltr">{profile.email}</div>
        </div>

        {/* Reset password — only for system_admin (uses admin API) */}
        {profile.role === 'system_admin' && (
          <div className="px-6 py-5 space-y-2">
            <div className="text-sm font-medium text-slate-700">איפוס סיסמה</div>
            <p className="text-xs text-slate-500">יוצר קישור לאיפוס ומעתיק ללוח.</p>
            <button
              onClick={handleResetPassword}
              disabled={resetStatus === 'loading'}
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50"
            >
              {resetStatus === 'loading' ? 'שולח...' : resetStatus === 'sent' ? 'הקישור הועתק ✓' : resetStatus === 'error' ? 'שגיאה' : 'צור קישור לאיפוס'}
            </button>
          </div>
        )}

        {/* Member since */}
        <div className="px-6 py-4">
          <span className="text-xs text-slate-400">
            חבר מאז {new Date(profile.created_at).toLocaleDateString('he-IL')}
          </span>
        </div>
      </div>
    </div>
  )
}
