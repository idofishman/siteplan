'use client'

import React from 'react'
import { useUiStore } from '@/stores/uiStore'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ColorSwatch } from '@/components/ui/ColorSwatch'
import { PageNodeMenu } from './PageNodeMenu'
import type { PageNode as PageNodeType } from '@/types'

interface Props {
  node: PageNodeType
  depth: number
  gscClicks: Record<string, number>
  visibleIds?: Set<string> | null
  searchQuery?: string
  showDragIcon?: boolean
}

function countDescendants(node: PageNodeType): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0)
}

function sumSubtreeClicks(node: PageNodeType, gscClicks: Record<string, number>): number {
  const own = node.url_normalized ? (gscClicks[node.url_normalized] ?? 0) : 0
  return node.children.reduce((sum, child) => sum + sumSubtreeClicks(child, gscClicks), own)
}

function getUrlPath(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://x${url.startsWith('/') ? '' : '/'}${url}`)
    return u.pathname + (u.search || '')
  } catch {
    return url
  }
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5 not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function formatClicks(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return n.toString()
}

export function PageNode({ node, depth, gscClicks, visibleIds, searchQuery, showDragIcon }: Props) {
  const { selectedPageIds, expandedNodeIds, toggleExpand, toggleSelect, openModal, openContextMenu } = useUiStore()
  const isSearching = visibleIds !== null && visibleIds !== undefined
  const isExpanded = isSearching ? true : expandedNodeIds.has(node.id)
  const isSelected = selectedPageIds.has(node.id)
  const hasChildren = node.children.length > 0
  const descendantCount = countDescendants(node)
  const hasGscData = Object.keys(gscClicks).length > 0
  const ownClicks = node.url_normalized ? (gscClicks[node.url_normalized] ?? 0) : 0
  const subtreeClicks = hasGscData ? sumSubtreeClicks(node, gscClicks) : 0

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') openModal('editPage', node)
    if (e.key === 'Delete' || e.key === 'Backspace') openModal('deletePage', { pageId: node.id, pageName: node.name })
    if (e.key === ' ') { e.preventDefault(); toggleSelect(node.id) }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    openContextMenu({ x: e.clientX, y: e.clientY, pageId: node.id })
  }

  return (
    <div>
      <div
        id={`page-node-${node.id}`}
        tabIndex={0}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        className={`
          group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
          ${isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'}
        `}
        style={{ paddingRight: `${depth * 20 + 12}px` }}
      >
        {/* Drag icon — visual affordance only; actual drag handle is on the outer wrapper */}
        {showDragIcon && (
          <span
            className="opacity-25 group-hover:opacity-70 shrink-0 text-slate-500 pointer-events-none select-none"
            aria-hidden="true"
            title="גרור להזזה"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 4a1 1 0 100 2 1 1 0 000-2zM13 4a1 1 0 100 2 1 1 0 000-2zM7 9a1 1 0 100 2 1 1 0 000-2zM13 9a1 1 0 100 2 1 1 0 000-2zM7 14a1 1 0 100 2 1 1 0 000-2zM13 14a1 1 0 100 2 1 1 0 000-2z" />
            </svg>
          </span>
        )}

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelect(node.id)}
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 data-[checked]:opacity-100 w-3.5 h-3.5 shrink-0 accent-blue-600"
          aria-label={`בחר ${node.name}`}
        />

        {/* Expand toggle */}
        <button
          onClick={() => hasChildren && toggleExpand(node.id)}
          className={`w-4 h-4 flex items-center justify-center shrink-0 text-slate-400 ${!hasChildren ? 'invisible' : ''}`}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'כווץ' : 'הרחב'}
        >
          <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 4.707a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Color swatch */}
        <ColorSwatch color={node.color} size={12} />

        {/* Name */}
        <span className="flex-1 text-sm text-slate-800 truncate min-w-0">
          {searchQuery ? highlight(node.name, searchQuery) : node.name}
        </span>

        {/* URL — path only, full URL in tooltip */}
        {node.url && (
          <span
            className="text-xs text-slate-400 truncate max-w-[240px] hidden sm:block"
            dir="ltr"
            title={node.url}
          >
            {searchQuery ? highlight(getUrlPath(node.url), searchQuery) : getUrlPath(node.url)}
          </span>
        )}

        {/* Descendant count */}
        {descendantCount > 0 && (
          <span
            className="text-[10px] font-medium text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5 leading-none shrink-0 tabular-nums"
            title={`${descendantCount} עמודים מתחת`}
          >
            {descendantCount}
          </span>
        )}

        {/* Subtree GSC total */}
        {hasGscData && subtreeClicks > 0 && (
          <span
            className="text-[10px] font-medium text-indigo-500 bg-indigo-50 rounded-full px-1.5 py-0.5 leading-none shrink-0 tabular-nums"
            title={`${subtreeClicks.toLocaleString('he-IL')} קליקים סה"כ (כולל תתי-עמודים)`}
          >
            ↓{formatClicks(subtreeClicks)}
          </span>
        )}

        {/* Own URL clicks */}
        {hasGscData && ownClicks > 0 && (
          <span
            className="text-[10px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5 leading-none shrink-0 tabular-nums"
            title={`${ownClicks.toLocaleString('he-IL')} קליקים לעמוד זה`}
          >
            {formatClicks(ownClicks)}
          </span>
        )}

        {/* Notes indicator */}
        {node.notes && (
          <span title={node.notes} className="text-slate-400 hover:text-slate-600 shrink-0" aria-label="יש הערות">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </span>
        )}

        {/* Status badge */}
        {node.status !== 'existing' && <StatusBadge status={node.status} size="xs" />}

        {/* Context menu */}
        <PageNodeMenu node={node} />
      </div>

      {/* Children */}
      {isExpanded && node.children.length > 0 && (
        <div>
          {node.children
            .filter(child => !visibleIds || visibleIds.has(child.id))
            .map(child => (
              <PageNode key={child.id} node={child} depth={depth + 1} gscClicks={gscClicks} visibleIds={visibleIds} searchQuery={searchQuery} />
            ))}
        </div>
      )}
    </div>
  )
}
