'use client'

import { useAccountStore } from '@/stores/accountStore'
import { SnapshotList } from '@/components/snapshots/SnapshotList'

export default function SnapshotsPage() {
  const { activeAccount } = useAccountStore()
  if (!activeAccount) return null

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <SnapshotList accountId={activeAccount.id} />
    </div>
  )
}
