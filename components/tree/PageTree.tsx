'use client'

import { useEffect } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { useTreeStore } from '@/stores/treeStore'
import { useUiStore } from '@/stores/uiStore'
import { DragDropProvider } from './DragDropProvider'
import { PageNode } from './PageNode'
import { EmptyState } from '@/components/ui/EmptyState'
import type { PageNode as PageNodeType } from '@/types'

interface Props {
  accountId: string
}

function DroppableLevel({ nodes, droppableId, depth, gscClicks }: {
  nodes: PageNodeType[]
  droppableId: string
  depth: number
  gscClicks: Record<string, number>
}) {
  return (
    <Droppable droppableId={droppableId}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={snapshot.isDraggingOver ? 'bg-blue-50 rounded-lg' : ''}
        >
          {nodes.map((node, index) => (
            <Draggable key={node.id} draggableId={node.id} index={index}>
              {(dragProvided) => (
                <div
                  ref={dragProvided.innerRef}
                  {...dragProvided.draggableProps}
                  {...dragProvided.dragHandleProps}
                >
                  <PageNode node={node} depth={depth} gscClicks={gscClicks} />
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )
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
    <DragDropProvider>
      <DroppableLevel nodes={tree} droppableId="root" depth={0} gscClicks={gscClicks} />
    </DragDropProvider>
  )
}
