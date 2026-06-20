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
    // Treat null/undefined sort_order as 0 to avoid NaN from arithmetic
    const bOrd = before ? (Number(before.sort_order) || 0) : undefined
    const aOrd = after  ? (Number(after.sort_order)  || 0) : undefined
    let newSortOrder: number
    if (bOrd === undefined && aOrd === undefined) newSortOrder = (destination.index + 1) * 1000
    else if (bOrd === undefined)                  newSortOrder = aOrd! - 1000
    else if (aOrd === undefined)                  newSortOrder = bOrd + 1000
    else                                          newSortOrder = Math.round((bOrd + aOrd) / 2)
    // Final safety net
    if (!isFinite(newSortOrder) || isNaN(newSortOrder)) newSortOrder = (destination.index + 1) * 1000

    const isSameParent = source.droppableId === destination.droppableId

    if (isSameParent) {
      // Same parent — apply immediately with no confirmation needed
      useTreeStore.getState().movePage(draggableId, newParentId, newSortOrder)
    } else {
      // Cross-parent move — open modal so user can confirm / correct the destination
      openModal('movePage', {
        pageId: draggableId,
        pageName: node.name,
        newParentId,
        newSortOrder,
      })
    }
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {children}
    </DragDropContext>
  )
}
