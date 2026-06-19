'use client'

import { useUiStore } from '@/stores/uiStore'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ColorSwatch } from '@/components/ui/ColorSwatch'
import { PageNodeMenu } from './PageNodeMenu'
import type { PageNode as PageNodeType } from '@/types'

interface Props {
  node: PageNodeType
  depth: number
  gscClicks: Record<string, number>
}

function GscIndicator({ clicks }: { clicks: number }) {
  const color =
    clicks >= 1000 ? '#F59E0B' :
    clicks >= 200  ? '#3B82F6' :
    clicks >= 50   ? '#22C55E' :
    clicks >= 1    ? '#94A3B8' :
    null

  if (!color) return null

  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded"
      style={{ color, backgroundColor: `${color}18` }}
      title={`${clicks.toLocaleString()} קליקים`}
    >
      {clicks >= 1000 ? `${Math.round(clicks / 1000)}k` : clicks}
    </span>
  )
}

export function PageNode({ node, depth, gscClicks }: Props) {
  const { selectedPageIds, expandedNodeIds, toggleExpand, toggleSelect } = useUiStore()
  const isExpanded = expandedNodeIds.has(node.id)
  const isSelected = selectedPageIds.has(node.id)
  const hasChildren = node.children.length > 0
  const clicks = node.url_normalized ? (gscClicks[node.url_normalized] ?? 0) : 0

  return (
    <div>
      <div
        className={`
          group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors
          ${isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'}
        `}
        style={{ paddingRight: `${depth * 20 + 12}px` }}
      >
        {/* Checkbox (visible on hover or when selected) */}
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
          {node.name}
        </span>

        {/* URL */}
        {node.url && (
          <span className="text-xs text-slate-400 truncate max-w-[180px] hidden sm:block" dir="ltr">
            {node.url}
          </span>
        )}

        {/* GSC clicks */}
        {clicks > 0 && <GscIndicator clicks={clicks} />}

        {/* Notes indicator */}
        {node.notes && (
          <span
            title={node.notes}
            className="text-slate-400 hover:text-slate-600 shrink-0"
            aria-label="יש הערות"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </span>
        )}

        {/* Status badge */}
        <StatusBadge status={node.status} size="xs" />

        {/* Context menu */}
        <PageNodeMenu node={node} />
      </div>

      {/* Children */}
      {isExpanded && node.children.length > 0 && (
        <div>
          {node.children.map(child => (
            <PageNode key={child.id} node={child} depth={depth + 1} gscClicks={gscClicks} />
          ))}
        </div>
      )}
    </div>
  )
}
