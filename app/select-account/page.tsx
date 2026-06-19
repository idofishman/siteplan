'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccountStore } from '@/stores/accountStore'
import { AccountSelector } from '@/components/account/AccountSelector'
import { signOut } from '@/app/login/actions'
import type { Profile } from '@/types'

export default function SelectAccountPage() {
  const router = useRouter()
  const { accounts, loading, loadAccounts, setActiveAccount } = useAccountStore()
  const [lastAccountId, setLastAccountId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    setLastAccountId(localStorage.getItem('last_account_id'))

    Promise.all([
      loadAccounts(),
      fetch('/api/me').then(r => r.ok ? r.json() : null),
    ]).then(([accs, me]) => {
      if (me) setProfile(me)

      if (accs.length === 1) {
        setActiveAccount(accs[0])
        router.replace('/app')
        return
      }

      // If stored last account is still accessible, auto-select
      const lastId = localStorage.getItem('last_account_id')
      if (lastId) {
        const match = accs.find(a => a.id === lastId)
        if (match) {
          setActiveAccount(match)
          router.replace('/app')
          return
        }
      }

      setInitialized(true)
    })
  }, [])

  if (loading || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <p className="text-slate-600 text-lg">לא הוקצו לך חשבונות</p>
        <form action={signOut}>
          <button type="submit" className="text-sm text-slate-500 underline hover:text-slate-700">
            התנתק
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">מנהל מבנה האתר</h1>
        <div className="flex items-center gap-4">
          {profile && (
            <span className="text-sm text-slate-300">{profile.display_name}</span>
          )}
          <form action={signOut}>
            <button type="submit" className="text-sm text-slate-300 hover:text-white transition-colors">
              התנתק
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h2 className="text-xl font-bold text-slate-800 mb-8">בחר חשבון לעבוד עליו</h2>
        <AccountSelector
          accounts={accounts}
          lastAccountId={lastAccountId}
          isAdmin={profile?.role === 'system_admin'}
        />
      </main>
    </div>
  )
}
