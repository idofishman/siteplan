import { create } from 'zustand'
import type { Account } from '@/types'

const LAST_ACCOUNT_KEY = 'last_account_id'

interface AccountStore {
  accounts: Account[]
  activeAccount: Account | null
  loading: boolean
  setActiveAccount: (account: Account) => void
  loadAccounts: () => Promise<Account[]>
  clearAccount: () => void
}

export const useAccountStore = create<AccountStore>((set, get) => ({
  accounts: [],
  activeAccount: null,
  loading: false,

  setActiveAccount(account: Account) {
    localStorage.setItem(LAST_ACCOUNT_KEY, account.id)
    set({ activeAccount: account })
  },

  clearAccount() {
    localStorage.removeItem(LAST_ACCOUNT_KEY)
    set({ activeAccount: null, accounts: [] })
  },

  async loadAccounts() {
    set({ loading: true })
    try {
      const res = await fetch('/api/accounts')
      if (!res.ok) throw new Error('Failed to load accounts')
      const accounts: Account[] = await res.json()
      set({ accounts, loading: false })

      // Restore last-used account if still accessible
      const lastId = localStorage.getItem(LAST_ACCOUNT_KEY)
      if (lastId) {
        const match = accounts.find(a => a.id === lastId)
        if (match && !get().activeAccount) {
          set({ activeAccount: match })
        }
      }

      return accounts
    } catch {
      set({ loading: false })
      return []
    }
  },
}))
