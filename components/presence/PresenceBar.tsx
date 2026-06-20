'use client'

import { useEffect, useState } from 'react'
import { usePresenceStore } from '@/stores/presenceStore'
import { useAccountStore } from '@/stores/accountStore'
import { Avatar } from '@/components/ui/Avatar'
import { PresencePopover } from './PresencePopover'
import { createClient } from '@/lib/supabase/client'
import type { PresenceUser } from '@/types'

const MAX_SHOWN = 5

function computeStatus(lastSeen: string): 'active' | 'inactive' {
  const diff = (Date.now() - new Date(lastSeen).getTime()) / 1000 / 60
  return diff < 2 ? 'active' : 'inactive'
}

export function PresenceBar() {
  const { activeAccount } = useAccountStore()
  const { users, setUsers, startHeartbeat, stopHeartbeat } = usePresenceStore()
  const [showPopover, setShowPopover] = useState(false)

  async function refreshPresence(accountId: string) {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const supabase = createClient()
    const { data } = await supabase
      .from('presence')
      .select('*')
      .eq('account_id', accountId)
      .gte('last_seen', cutoff)
      .order('last_seen', { ascending: false })

    if (data) {
      const presenceUsers: PresenceUser[] = data.map((r: { user_id: string; account_id: string; display_name: string; last_seen: string }) => ({
        user_id: r.user_id,
        account_id: r.account_id,
        display_name: r.display_name,
        last_seen: r.last_seen,
        status: computeStatus(r.last_seen),
      }))
      setUsers(presenceUsers)
    }
  }

  useEffect(() => {
    if (!activeAccount) return

    // Subscribe to Realtime presence changes
    const supabase = createClient()
    const channel = supabase
      .channel(`presence-${activeAccount.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'presence', filter: `account_id=eq.${activeAccount.id}` },
        () => refreshPresence(activeAccount.id)
      )
      .subscribe()

    // Initial load + heartbeat
    refreshPresence(activeAccount.id)
    startHeartbeat(activeAccount.id, '')

    return () => {
      supabase.removeChannel(channel)
      stopHeartbeat()
    }
  }, [activeAccount?.id])

  if (!activeAccount || users.length === 0) return null

  const shown = users.slice(0, MAX_SHOWN)
  const overflow = users.length - MAX_SHOWN

  return (
    <div className="bg-slate-100 border-b border-slate-200 px-4 py-1.5 flex items-center gap-2 text-xs text-slate-500">
      <span className="shrink-0">מחובר:</span>
      <div className="flex items-center gap-1">
        {shown.map(u => (
          <div key={u.user_id} title={u.display_name || 'משתמש'}>
            <Avatar name={u.display_name} size="sm" isActive={u.status === 'active'} />
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <button
          onClick={() => setShowPopover(v => !v)}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          +{overflow} עוד
        </button>
      )}

      {showPopover && <PresencePopover users={users} onClose={() => setShowPopover(false)} />}
    </div>
  )
}
