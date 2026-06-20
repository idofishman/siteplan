'use client'

import { useState, useRef, useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'
import type { PageNode } from '@/types'

interface Props {
  node: PageNode
}

export function PageNodeMenu({ node }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { openModal } = useUiStore()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function action(fn: () => void) {
    setOpen(false)
    fn()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 text-slate-500"
        aria-label="פעולות נוספות"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {open && (
        <div className="absolute start-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50">
          <button
            onClick={() => action(() => openModal('addPage', { parentId: node.id }))}
            className="w-full text-right px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            + הוסף עמוד ילד
          </button>
          <button
            onClick={() => action(() => openModal('editPage', node))}
            className="w-full text-right px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            ✏️ עריכה
          </button>
          <button
            onClick={() => action(() => openModal('pageHistory', { pageId: node.id, pageName: node.name }))}
            className="w-full text-right px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            📋 היסטוריית שינויים
          </button>
          <hr className="border-slate-100" />
          <button
            onClick={() => action(() => openModal('deletePage', { pageId: node.id, pageName: node.name }))}
            className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            🗑 מחיקה
          </button>
        </div>
      )}
    </div>
  )
}
