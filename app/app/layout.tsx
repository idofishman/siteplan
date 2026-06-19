'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccountStore } from '@/stores/accountStore'
import { AccountSwitcher } from '@/components/account/AccountSwitcher'
import { signOut } from '@/app/login/actions'
import type { Profile } from '@/types'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { activeAccount, loadAccounts, setActiveAccount } = useAccountStore()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([
      loadAccounts(),
      fetch('/api/me').then(r => r.ok ? r.json() : null),
    ]).then(([accs, me]) => {
      if (me) setProfile(me)

      if (accs.length === 0) {
        router.replace('/select-account')
        return
      }

      // If no active account yet, determine which one to use
      if (!useAccountStore.getState().activeAccount) {
        if (accs.length === 1) {
          setActiveAccount(accs[0])
        } else {
          // Multiple accounts, none selected → go to selector
          router.replace('/select-account')
          return
        }
      }

      setReady(true)
    })
  }, [])

  if (!ready || !activeAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-200">מנהל מבנה האתר</span>
          <span className="text-slate-600">|</span>
          <AccountSwitcher />
        </div>
        <div className="flex items-center gap-4">
          {profile && (
            <span className="text-sm text-slate-300">{profile.display_name}</span>
          )}
          {profile?.role === 'system_admin' && (
            <a href="/admin" className="text-sm text-slate-300 hover:text-white transition-colors">
              ניהול
            </a>
          )}
          <form action={signOut}>
            <button type="submit" className="text-sm text-slate-300 hover:text-white transition-colors">
              התנתק
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  )
}
