'use client'

import { useAccountStore } from '@/stores/accountStore'
import { ActivityFeed } from '@/components/activity/ActivityFeed'

export default function ActivityPage() {
  const { activeAccount } = useAccountStore()
  if (!activeAccount) return null

  return (
    <div className="max-w-3xl mx-auto py-6">
      <h1 className="text-xl font-bold text-slate-800 px-4 mb-4">היסטוריית פעולות</h1>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <ActivityFeed accountId={activeAccount.id} />
      </div>
    </div>
  )
}
