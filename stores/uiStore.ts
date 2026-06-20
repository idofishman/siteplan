import { create } from 'zustand'

const EXPANDED_KEY = 'sitemap_expanded_nodes'

export interface ContextMenuState {
  x: number
  y: number
  pageId: string
}

interface UiStore {
  selectedPageIds: Set<string>
  expandedNodeIds: Set<string>
  activeModal: string | null
  modalPayload: unknown
  contextMenu: ContextMenuState | null

  toggleSelect: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void

  toggleExpand: (id: string) => void
  expandAll: (ids: string[]) => void
  collapseAll: (keepId?: string) => void
  initExpanded: () => void

  openModal: (name: string, payload?: unknown) => void
  closeModal: () => void

  openContextMenu: (state: ContextMenuState) => void
  closeContextMenu: () => void
}

export const useUiStore = create<UiStore>((set, get) => ({
  selectedPageIds: new Set(),
  expandedNodeIds: new Set(),
  activeModal: null,
  modalPayload: undefined,
  contextMenu: null,

  toggleSelect(id: string) {
    set(state => {
      const next = new Set(state.selectedPageIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedPageIds: next }
    })
  },

  selectAll(ids: string[]) {
    set({ selectedPageIds: new Set(ids) })
  },

  clearSelection() {
    set({ selectedPageIds: new Set() })
  },

  toggleExpand(id: string) {
    set(state => {
      const next = new Set(state.expandedNodeIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      // Persist to localStorage
      try {
        localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]))
      } catch {}
      return { expandedNodeIds: next }
    })
  },

  expandAll(ids: string[]) {
    set(state => {
      const next = new Set([...state.expandedNodeIds, ...ids])
      try { localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next])) } catch {}
      return { expandedNodeIds: next }
    })
  },

  collapseAll(keepId?: string) {
    const next = keepId ? new Set([keepId]) : new Set<string>()
    try { localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next])) } catch {}
    set({ expandedNodeIds: next })
  },

  initExpanded() {
    try {
      const stored = localStorage.getItem(EXPANDED_KEY)
      if (stored) {
        const ids: string[] = JSON.parse(stored)
        set({ expandedNodeIds: new Set(ids) })
      }
    } catch {}
  },

  openModal(name: string, payload?: unknown) {
    set({ activeModal: name, modalPayload: payload, contextMenu: null })
  },

  closeModal() {
    set({ activeModal: null, modalPayload: undefined })
  },

  openContextMenu(state: ContextMenuState) {
    set({ contextMenu: state })
  },

  closeContextMenu() {
    set({ contextMenu: null })
  },
}))
