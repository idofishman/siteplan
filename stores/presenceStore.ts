import { create } from 'zustand'
import type { PresenceUser } from '@/types'

interface PresenceStore {
  users: PresenceUser[]
  _intervalId: ReturnType<typeof setInterval> | null

  startHeartbeat: (accountId: string, displayName: string) => void
  stopHeartbeat: () => void
  setUsers: (users: PresenceUser[]) => void
}

async function sendHeartbeat(accountId: string) {
  await fetch('/api/presence/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_id: accountId }),
  })
}

export const usePresenceStore = create<PresenceStore>((set, get) => ({
  users: [],
  _intervalId: null,

  startHeartbeat(accountId: string, _displayName: string) {
    get().stopHeartbeat()

    // Send immediately then every 30s
    sendHeartbeat(accountId)
    const id = setInterval(() => sendHeartbeat(accountId), 30000)
    set({ _intervalId: id })
  },

  stopHeartbeat() {
    const id = get()._intervalId
    if (id) {
      clearInterval(id)
      set({ _intervalId: null })
    }
  },

  setUsers(users: PresenceUser[]) {
    set({ users })
  },
}))
