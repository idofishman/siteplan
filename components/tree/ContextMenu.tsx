'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'

export function ContextMenu() {
  const { contextMenu, closeContextMenu, openModal } = useUiStore()
  const { pages } = useTreeStore()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick() { closeContextMenu() }
    function handleScroll() { closeContextMenu() }
    if (contextMenu) {
      document.addEventListener('mousedown', handleClick)
      window.addEventListener('scroll', handleScroll, true)
    }
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [contextMenu, closeContextMenu])

  if (!contextMenu) return null

  const page = pages.find(p => p.id === contextMenu.pageId)
  if (!page) return null

  // Clamp position so menu doesn't overflow viewport
  const MENU_W = 192
  const MENU_H = 160
  const x = Math.min(contextMenu.x, window.innerWidth - MENU_W - 8)
  const y = Math.min(contextMenu.y, window.innerHeight - MENU_H - 8)

  function action(fn: () => void) {
    closeContextMenu()
    fn()
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] w-48 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden text-sm"
      style={{ left: x, top: y }}
      onMouseDown={e => e.stopPropagation()}
    >
      <button
        onClick={() => action(() => openModal('addPage', { parentId: page.id }))}
        className="w-full text-right px-4 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
      >
        <span>+</span> הוסף עמוד ילד
      </button>
      <button
        onClick={() => action(() => openModal('editPage', page))}
        className="w-full text-right px-4 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
      >
        <span>✏️</span> עריכה
      </button>
      <button
        onClick={() => action(() => openModal('pageHistory', { pageId: page.id, pageName: page.name }))}
        className="w-full text-right px-4 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
      >
        <span>📋</span> היסטוריית שינויים
      </button>
      <hr className="border-slate-100" />
      <button
        onClick={() => action(() => openModal('deletePage', { pageId: page.id, pageName: page.name }))}
        className="w-full text-right px-4 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2"
      >
        <span>🗑</span> מחיקה
      </button>
    </div>,
    document.body
  )
}
