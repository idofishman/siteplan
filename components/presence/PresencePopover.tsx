'use client'

import { useEffect, useRef } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import type { PresenceUser } from '@/types'

interface Props {
  users: PresenceUser[]
  onClose: () => void
}

export function PresencePopover({ users, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  function getStatusText(u: PresenceUser) {
    const diff = Math.floor((Date.now() - new Date(u.last_seen).getTime()) / 1000 / 60)
    if (diff < 2) return 'פעיל כעת'
    return `לא פעיל ${diff} דקות`
  }

  return (
    <div
      ref={ref}
      className="absolute top-full mt-1 start-0 w-56 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50"
    >
      <div className="px-3 py-2 text-xs font-medium text-slate-500 border-b border-slate-100">
        כל המשתמשים המחוברים
      </div>
      {users.map(u => (
        <div key={u.user_id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50">
          <Avatar name={u.display_name} isActive={u.status === 'active'} />
          <div>
            <p className="text-sm font-medium text-slate-700">{u.display_name}</p>
            <p className={`text-xs ${u.status === 'active' ? 'text-green-600' : 'text-amber-500'}`}>
              {getStatusText(u)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
