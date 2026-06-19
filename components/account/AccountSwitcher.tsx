'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Account } from '@/types'
import { useAccountStore } from '@/stores/accountStore'

export function AccountSwitcher() {
  const router = useRouter()
  const { activeAccount, accounts, setActiveAccount } = useAccountStore()
  const [open, setOpen] = useState(false)

  if (!activeAccount) return null

  const others = accounts.filter(a => a.id !== activeAccount.id)

  function handleSwitch(account: Account) {
    setActiveAccount(account)
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
      >
        <span>{activeAccount.name}</span>
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && others.length > 0 && (
        <div className="absolute top-full mt-1 start-0 min-w-[180px] bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50">
          {others.map(account => (
            <button
              key={account.id}
              onClick={() => handleSwitch(account)}
              className="w-full text-right px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {account.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
