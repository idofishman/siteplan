'use client'

import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import { findNode } from '@/lib/utils/tree'

interface Props {
  children: React.ReactNode
}

export function DragDropProvider({ children }: Props) {
  const { openModal } = useUiStore()
  const { tree } = useTreeStore()

  function onDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result
    if (!destination) return
    // Same position — no-op
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newParentId = destination.droppableId === 'root' ? null : destination.droppableId
    const newSortOrder = destination.index

    const node = findNode(tree, draggableId)
    if (!node) return

    // Same parent, just reordering — silent save (no confirm)
    if (source.droppableId === destination.droppableId) {
      useTreeStore.getState().movePage(draggableId, newParentId, newSortOrder)
      return
    }

    // Different parent — show confirm modal
    openModal('movePage', {
      pageId: draggableId,
      pageName: node.name,
      newParentId,
      newSortOrder,
    })
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {children}
    </DragDropContext>
  )
}
