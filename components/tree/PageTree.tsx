'use client'

import { useEffect } from 'react'
import { useTreeStore } from '@/stores/treeStore'
import { useUiStore } from '@/stores/uiStore'
import { PageNode } from './PageNode'
import { EmptyState } from '@/components/ui/EmptyState'

interface Props {
  accountId: string
}

export function PageTree({ accountId }: Props) {
  const { tree, gscClicks, loadPages } = useTreeStore()
  const { initExpanded } = useUiStore()

  useEffect(() => {
    initExpanded()
    loadPages(accountId)
  }, [accountId])

  if (tree.length === 0) {
    return (
      <EmptyState
        title="אין עמודים עדיין"
        description="לחץ על '+ הוסף עמוד' כדי להוסיף עמוד ראשון"
      />
    )
  }

  return (
    <div className="py-2">
      {tree.map(node => (
        <PageNode key={node.id} node={node} depth={0} gscClicks={gscClicks} />
      ))}
    </div>
  )
}
