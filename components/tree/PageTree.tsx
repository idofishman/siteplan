'use client'

import { useEffect } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { useTreeStore } from '@/stores/treeStore'
import { useUiStore } from '@/stores/uiStore'
import { DragDropProvider } from './DragDropProvider'
import { PageNode } from './PageNode'
import { EmptyState } from '@/components/ui/EmptyState'
import type { PageNode as PageNodeType } from '@/types'

interface LevelProps {
  nodes: PageNodeType[]
  droppableId: string
  depth: number
  gscClicks: Record<string, number>
  visibleIds?: Set<string> | null
  searchQuery?: string
  exactMatchId?: string | null
}

function DroppableLevel({ nodes, droppableId, depth, gscClicks, visibleIds, searchQuery, exactMatchId }: LevelProps) {
  const { expandedNodeIds } = useUiStore()
  const isSearching = visibleIds !== null && visibleIds !== undefined
  const filteredNodes = visibleIds ? nodes.filter(n => visibleIds.has(n.id)) : nodes

  return (
    <Droppable droppableId={droppableId}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={snapshot.isDraggingOver ? 'bg-blue-50/50 rounded-lg' : ''}
        >
          {filteredNodes.map((node, index) => {
            const isExpanded = isSearching ? true : expandedNodeIds.has(node.id)
            const hasChildren = node.children.length > 0

            return (
              <Draggable key={node.id} draggableId={node.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    style={{
                      ...dragProvided.draggableProps.style,
                      opacity: dragSnapshot.isDragging ? 0.85 : 1,
                    }}
                  >
                    <div
                      {...dragProvided.dragHandleProps}
                      style={{ userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
                    >
                      <PageNode
                        node={node}
                        depth={depth}
                        gscClicks={gscClicks}
                        visibleIds={visibleIds}
                        searchQuery={searchQuery}
                        exactMatchId={exactMatchId}
                        showDragIcon
                      />
                    </div>

                    {hasChildren && isExpanded && (
                      <DroppableLevel
                        nodes={node.children}
                        droppableId={node.id}
                        depth={depth + 1}
                        gscClicks={gscClicks}
                        visibleIds={visibleIds}
                        searchQuery={searchQuery}
                        exactMatchId={exactMatchId}
                      />
                    )}
                  </div>
                )}
              </Draggable>
            )
          })}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )
}

export function PageTree({ accountId, visibleIds, searchQuery, exactMatchId }: { accountId: string; visibleIds?: Set<string> | null; searchQuery?: string; exactMatchId?: string | null }) {
  const { tree, gscClicks, loading, loadPages, loadGsc } = useTreeStore()
  const { initExpanded } = useUiStore()

  useEffect(() => {
    initExpanded()
    loadPages(accountId)
    loadGsc(accountId)
  }, [accountId])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
        <p className="text-sm">טוען את מבנה האתר...</p>
      </div>
    )
  }

  if (tree.length === 0) {
    return (
      <EmptyState
        title="אין עמודים עדיין"
        description="לחץ על '+ הוסף עמוד' כדי להוסיף עמוד ראשון"
      />
    )
  }

  if (visibleIds !== null && visibleIds !== undefined && visibleIds.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
        <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p className="text-sm">לא נמצאו עמודים תואמים</p>
      </div>
    )
  }

  return (
    <DragDropProvider>
      <DroppableLevel
        nodes={tree}
        droppableId="root"
        depth={0}
        gscClicks={gscClicks}
        visibleIds={visibleIds}
        searchQuery={searchQuery}
        exactMatchId={exactMatchId}
      />
    </DragDropProvider>
  )
}
