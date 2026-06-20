'use client'

import { useRef } from 'react'
import { DragDropContext, type DropResult, type DragUpdate } from '@hello-pangea/dnd'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import { findNode } from '@/lib/utils/tree'

interface Props {
  children: React.ReactNode
}

export function DragDropProvider({ children }: Props) {
  const { openModal, expandAll, setDragging } = useUiStore()
  const { tree } = useTreeStore()

  const mousePos = useRef({ x: 0, y: 0 })
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHoveredId = useRef<string | null>(null)

  function trackMouse(e: MouseEvent) {
    mousePos.current = { x: e.clientX, y: e.clientY }
  }

  function clearHoverTimer() {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null }
  }

  function onDragStart() {
    setDragging(true)
    window.addEventListener('mousemove', trackMouse)
  }

  function onDragUpdate(_update: DragUpdate) {
    // Detect which page node row the mouse is hovering over by pointer position
    const el = document.elementFromPoint(mousePos.current.x, mousePos.current.y)
    const row = el?.closest('[id^="page-node-"]') as HTMLElement | null
    const nodeId = row?.id?.replace('page-node-', '') ?? null

    if (nodeId === lastHoveredId.current) return
    clearHoverTimer()
    lastHoveredId.current = nodeId

    if (!nodeId) return
    const { expandedNodeIds } = useUiStore.getState()
    const node = findNode(useTreeStore.getState().tree, nodeId)
    // Auto-expand collapsed nodes with children after 600ms hover
    if (node && node.children.length > 0 && !expandedNodeIds.has(nodeId)) {
      hoverTimer.current = setTimeout(() => expandAll([nodeId]), 600)
    }
  }

  function onDragEnd(result: DropResult) {
    window.removeEventListener('mousemove', trackMouse)
    clearHoverTimer()
    lastHoveredId.current = null
    setDragging(false)

    const { draggableId, destination, source } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newParentId = destination.droppableId === 'root' ? null : destination.droppableId
    const node = findNode(tree, draggableId)
    if (!node) return

    // Use fresh tree snapshot so sort_order values reflect any mid-drag expansions
    const currentTree = useTreeStore.getState().tree
    const destNode = destination.droppableId === 'root' ? null : findNode(currentTree, destination.droppableId)
    const siblings = (destNode ? destNode.children : currentTree).filter(n => n.id !== draggableId)
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
    <DragDropContext onDragStart={onDragStart} onDragUpdate={onDragUpdate} onDragEnd={onDragEnd}>
      {children}
    </DragDropContext>
  )
}
