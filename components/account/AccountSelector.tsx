'use client'

import { useRouter } from 'next/navigation'
import type { Account } from '@/types'
import { useAccountStore } from '@/stores/accountStore'

interface Props {
  accounts: Account[]
  lastAccountId: string | null
  isAdmin: boolean
}

export function AccountSelector({ accounts, lastAccountId, isAdmin }: Props) {
  const router = useRouter()
  const { setActiveAccount } = useAccountStore()

  // Sort: last used first, then alphabetical
  const sorted = [...accounts].sort((a, b) => {
    if (a.id === lastAccountId) return -1
    if (b.id === lastAccountId) return 1
    return a.name.localeCompare(b.name, 'he')
  })

  function handleSelect(account: Account) {
    setActiveAccount(account)
    router.push('/app')
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {sorted.map(account => (
        <button
          key={account.id}
          onClick={() => handleSelect(account)}
          className={`
            relative text-right p-4 rounded-xl border-2 transition-all
            hover:shadow-md hover:border-slate-400 bg-white
            ${account.id === lastAccountId ? 'border-blue-400' : 'border-slate-200'}
          `}
        >
          {account.id === lastAccountId && (
            <span className="absolute top-2 left-2 text-blue-400 text-xs">★</span>
          )}
          <p className="font-semibold text-slate-800 truncate">{account.name}</p>
          <p className="text-sm text-slate-500 truncate mt-0.5">{account.domain ?? account.slug}</p>
        </button>
      ))}

      {isAdmin && (
        <button
          onClick={() => router.push('/admin/accounts')}
          className="text-right p-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-all"
        >
          <p className="font-medium">+ צור חשבון חדש</p>
        </button>
      )}
    </div>
  )
}
