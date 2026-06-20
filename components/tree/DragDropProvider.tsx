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

  function onDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const tree = useTreeStore.getState().tree
    const newParentId = destination.droppableId === 'root' ? null : destination.droppableId
    const node = findNode(tree, draggableId)
    if (!node) return

    const destNode = destination.droppableId === 'root' ? null : findNode(tree, destination.droppableId)
    const siblings = (destNode ? destNode.children : tree).filter(n => n.id !== draggableId)
    const before = siblings[destination.index - 1]
    const after  = siblings[destination.index]
    let newSortOrder: number
    if (!before && !after)   newSortOrder = 1000
    else if (!before)        newSortOrder = after.sort_order - 1
    else if (!after)         newSortOrder = before.sort_order + 1
    else                     newSortOrder = (before.sort_order + after.sort_order) / 2

    openModal('movePage', {
      pageId: draggableId,
      pageName: node.name,
      newParentId,
      newSortOrder,
      isSameParent: source.droppableId === destination.droppableId,
    })
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {children}
    </DragDropContext>
  )
}
