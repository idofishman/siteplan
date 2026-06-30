'use client'

import React from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PageNodeMenu } from './PageNodeMenu'
import type { PageNode as PageNodeType } from '@/types'

function timeAgoHe(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'עכשיו'
  if (mins < 60) return `לפני ${mins} דק׳`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `לפני ${hrs} שע׳`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `לפני ${days} ימים`
  if (days < 30) return `לפני ${Math.floor(days / 7)} שב׳`
  return new Date(iso).toLocaleDateString('he-IL')
}

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
  const { profilesMap } = useTreeStore()
  const isSearching = visibleIds !== null && visibleIds !== undefined
  const isExpanded = isSearching ? true : expandedNodeIds.has(node.id)
  const isSelected = selectedPageIds.has(node.id)
  const hasChildren = node.children.length > 0
  const descendantCount = countDescendants(node)
  const hasGscData = Object.keys(gscClicks).length > 0
  const ownClicks = node.url_normalized ? (gscClicks[node.url_normalized] ?? 0) : 0
  const subtreeClicks = hasGscData ? sumSubtreeClicks(node, gscClicks) : 0
  const accentColor = node.color ?? null

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
          ${node.is_deleted ? 'opacity-50' : isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'}
        `}
        style={{
          paddingRight: `${depth * 20 + 12}px`,
          ...(accentColor ? { borderRight: `4px solid ${accentColor}` } : { borderRight: '4px solid transparent' }),
        }}
      >
        {/* 1. Drag icon — visual affordance only; actual drag handle is on the outer wrapper */}
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

        {/* 2. Expand toggle — always takes fixed width for alignment */}
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

        {/* 3. Name (with color dot if color is set) */}
        <span className="flex-1 flex items-center gap-1.5 min-w-0">
          {accentColor && (
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
          )}
          <span
            className={`text-sm truncate min-w-0 ${node.is_deleted ? 'line-through text-slate-400' : 'text-slate-800'}`}
            title={node.updated_at
              ? `עודכן ${timeAgoHe(node.updated_at)}${node.updated_by && profilesMap[node.updated_by] ? ` ע"י ${profilesMap[node.updated_by]}` : ''}`
              : undefined}
          >
            {searchQuery ? highlight(node.name, searchQuery) : node.name}
          </span>
          {node.is_deleted && (
            <span className="text-[10px] text-red-400 font-medium shrink-0">מחוק</span>
          )}
          {/* Last-edited chip — shown on hover via group */}
          {!node.is_deleted && node.updated_at && (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
              {node.updated_by && profilesMap[node.updated_by]
                ? `${profilesMap[node.updated_by]} · ${timeAgoHe(node.updated_at)}`
                : timeAgoHe(node.updated_at)}
            </span>
          )}
        </span>

        {/* 4. Descendant count — fixed slot, empty when zero */}
        <span className="w-8 shrink-0 text-right">
          {descendantCount > 0 && (
            <span
              className="text-[10px] font-medium text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5 leading-none tabular-nums"
              title={`${descendantCount} עמודים מתחת`}
            >
              {descendantCount}
            </span>
          )}
        </span>

        {/* 5. Template — fixed slot */}
        <span className="w-20 shrink-0 hidden sm:block">
          {node.template && (
            <span className="text-[10px] text-slate-300 truncate block" title={node.template}>
              {node.template}
            </span>
          )}
        </span>

        {/* Notes + Status — fixed slot */}
        <span className="w-8 shrink-0 flex items-center gap-1">
          {node.notes && (
            <span title={node.notes} className="shrink-0 text-slate-400 hover:text-slate-600" aria-label="יש הערות">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </span>
          )}
          {node.status !== 'existing' && <StatusBadge status={node.status} size="xs" />}
        </span>

        {/* 6. URL — fixed slot, clickable to open in new tab */}
        <span className="w-[180px] shrink-0 hidden sm:block">
          {node.url && (
            <a
              href={node.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs text-slate-400 hover:text-blue-500 truncate block hover:underline"
              dir="ltr"
              title={node.url}
            >
              {searchQuery ? highlight(getUrlPath(node.url), searchQuery) : getUrlPath(node.url)}
            </a>
          )}
        </span>

        {/* 7. Own GSC clicks — fixed slot */}
        <span className="w-14 shrink-0 flex justify-end">
          {hasGscData && ownClicks > 0 && (
            <span
              className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5 leading-none tabular-nums"
              title={`${ownClicks.toLocaleString('he-IL')} קליקים לעמוד זה`}
            >
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
              {formatClicks(ownClicks)}
            </span>
          )}
        </span>

        {/* 8. Subtree GSC — fixed slot */}
        <span className="w-12 shrink-0 flex justify-end">
          {hasGscData && subtreeClicks > ownClicks && (
            <span
              className="text-[10px] font-medium text-slate-400 bg-slate-50 rounded-full px-1.5 py-0.5 leading-none tabular-nums"
              title={`${subtreeClicks.toLocaleString('he-IL')} קליקים סה"כ (כולל תתי-עמודים)`}
            >
              ↓{formatClicks(subtreeClicks)}
            </span>
          )}
        </span>

        {/* 9. Context menu */}
        <PageNodeMenu node={node} />
      </div>
    </div>
  )
}
