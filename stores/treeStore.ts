import { create } from 'zustand'
import type { Page, PageNode, BulkOperationPayload, ImportApplyPayload, ImportApplyResult } from '@/types'
import { buildTree } from '@/lib/utils/tree'
import { useUiStore } from '@/stores/uiStore'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface TreeStore {
  pages: Page[]          // ALL pages including soft-deleted
  tree: PageNode[]       // filtered tree — respects showDeleted
  saveStatus: SaveStatus
  gscClicks: Record<string, number>
  accountId: string | null
  showDeleted: boolean

  loadPages: (accountId: string) => Promise<void>
  loadGsc: (accountId: string) => Promise<void>
  setShowDeleted: (v: boolean) => void

  addPage: (data: Partial<Page>) => Promise<void>
  updatePage: (id: string, data: Partial<Page>) => Promise<void>
  deletePage: (id: string, options?: { reassign_to?: string; cascade?: boolean }) => Promise<void>
  restorePage: (id: string) => Promise<void>
  movePage: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>

  bulkOperation: (payload: BulkOperationPayload) => Promise<void>
  importApply: (payload: ImportApplyPayload) => Promise<ImportApplyResult>

  handleRemotePageChange: (event: 'INSERT' | 'UPDATE' | 'DELETE', page: Page) => void

  setSaveStatus: (status: SaveStatus) => void
}

function buildFilteredTree(pages: Page[], showDeleted: boolean) {
  const visible = showDeleted ? pages : pages.filter(p => !p.is_deleted)
  return { pages, tree: buildTree(visible) }
}

// Convenience: rebuild tree with current showDeleted state
function setTree(pages: Page[], showDeleted: boolean) {
  return buildFilteredTree(pages, showDeleted)
}

export const useTreeStore = create<TreeStore>((set, get) => ({
  pages: [],
  tree: [],
  saveStatus: 'idle',
  gscClicks: {},
  accountId: null,
  showDeleted: false,

  setSaveStatus(status: SaveStatus) {
    set({ saveStatus: status })
  },

  setShowDeleted(v: boolean) {
    set(state => ({ showDeleted: v, tree: buildTree(v ? state.pages : state.pages.filter(p => !p.is_deleted)) }))
  },

  async loadPages(accountId: string) {
    set({ accountId })
    const res = await fetch(`/api/pages?account_id=${accountId}`)
    if (!res.ok) return
    const pages: Page[] = await res.json()
    set(state => setTree(pages, state.showDeleted))
    // Always keep homepage expanded
    const homepage = pages.find(p => p.template === 'homepage' && !p.parent_id)
    if (homepage) {
      useUiStore.getState().expandAll([homepage.id])
    }
  },

  async loadGsc(accountId: string) {
    const res = await fetch(`/api/gsc?account_id=${accountId}`)
    if (!res.ok) return
    const clicks = await res.json()
    const map: Record<string, number> = {}
    for (const row of clicks) {
      if (row.url_normalized) map[row.url_normalized] = row.clicks
    }
    set({ gscClicks: map })
  },

  async addPage(data: Partial<Page>) {
    const tempId = crypto.randomUUID()
    const optimistic: Page = {
      id: tempId,
      account_id: get().accountId ?? '',
      parent_id: null,
      name: '',
      url: null,
      url_normalized: null,
      color: null,
      template: null,
      status: 'planned',
      notes: null,
      sort_order: 0,
      is_deleted: false,
      deleted_at: null,
      created_by: null,
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    }
    set(state => setTree([...state.pages, optimistic], state.showDeleted))
    set({ saveStatus: 'saving' })

    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed')
      const page: Page = await res.json()
      set(state => setTree(state.pages.map(p => p.id === tempId ? page : p), state.showDeleted))
      set({ saveStatus: 'saved' })
      setTimeout(() => set({ saveStatus: 'idle' }), 3000)
    } catch {
      set(state => setTree(state.pages.filter(p => p.id !== tempId), state.showDeleted))
      set({ saveStatus: 'error' })
    }
  },

  async updatePage(id: string, data: Partial<Page>) {
    const prev = get().pages.find(p => p.id === id)
    set(state => setTree(state.pages.map(p => p.id === id ? { ...p, ...data } : p), state.showDeleted))
    set({ saveStatus: 'saving' })

    try {
      const res = await fetch(`/api/pages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed')
      const page: Page = await res.json()
      set(state => setTree(state.pages.map(p => p.id === id ? page : p), state.showDeleted))
      set({ saveStatus: 'saved' })
      setTimeout(() => set({ saveStatus: 'idle' }), 3000)
    } catch {
      if (prev) set(state => setTree(state.pages.map(p => p.id === id ? prev : p), state.showDeleted))
      set({ saveStatus: 'error' })
    }
  },

  async deletePage(id: string, options?: { reassign_to?: string; cascade?: boolean }) {
    const prev = get().pages
    const now = new Date().toISOString()
    // Optimistically mark as deleted (soft delete)
    if (options?.cascade) {
      const { getDescendantIds } = await import('@/lib/utils/tree')
      const descendantIds = getDescendantIds(get().tree, id)
      const toMark = new Set([id, ...descendantIds])
      set(state => setTree(
        state.pages.map(p => toMark.has(p.id) ? { ...p, is_deleted: true, deleted_at: now } : p),
        state.showDeleted
      ))
    } else if (options?.reassign_to) {
      set(state => setTree(
        state.pages
          .map(p => p.id === id ? { ...p, is_deleted: true, deleted_at: now } : p)
          .map(p => p.parent_id === id ? { ...p, parent_id: options.reassign_to! } : p),
        state.showDeleted
      ))
    } else {
      set(state => setTree(
        state.pages.map(p => p.id === id ? { ...p, is_deleted: true, deleted_at: now } : p),
        state.showDeleted
      ))
    }
    set({ saveStatus: 'saving' })

    try {
      const body = options ? JSON.stringify(options) : undefined
      const res = await fetch(`/api/pages/${id}`, {
        method: 'DELETE',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      })
      if (!res.ok) throw new Error('Failed')
      set({ saveStatus: 'saved' })
      setTimeout(() => set({ saveStatus: 'idle' }), 3000)
      if (options?.reassign_to || options?.cascade) {
        await get().loadPages(get().accountId!)
      }
    } catch {
      set(state => setTree(prev, state.showDeleted))
      set({ saveStatus: 'error' })
    }
  },

  async restorePage(id: string) {
    const prev = get().pages
    set(state => setTree(
      state.pages.map(p => p.id === id ? { ...p, is_deleted: false, deleted_at: null } : p),
      state.showDeleted
    ))
    set({ saveStatus: 'saving' })
    try {
      const res = await fetch(`/api/pages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_deleted: false, deleted_at: null }),
      })
      if (!res.ok) throw new Error('Failed')
      const page: Page = await res.json()
      set(state => setTree(state.pages.map(p => p.id === id ? page : p), state.showDeleted))
      set({ saveStatus: 'saved' })
      setTimeout(() => set({ saveStatus: 'idle' }), 3000)
    } catch {
      set(state => setTree(prev, state.showDeleted))
      set({ saveStatus: 'error' })
    }
  },

  async movePage(id: string, newParentId: string | null, newSortOrder: number) {
    const prev = get().pages
    set(state => setTree(state.pages.map(p =>
      p.id === id ? { ...p, parent_id: newParentId, sort_order: newSortOrder } : p
    ), state.showDeleted))
    set({ saveStatus: 'saving' })

    try {
      const res = await fetch(`/api/pages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: newParentId, sort_order: newSortOrder }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[movePage] API error:', err)
        throw new Error(err.error ?? 'Failed')
      }
      const page: Page = await res.json()
      set(state => setTree(state.pages.map(p => p.id === id ? page : p), state.showDeleted))
      set({ saveStatus: 'saved' })
      setTimeout(() => set({ saveStatus: 'idle' }), 3000)
    } catch (e) {
      console.error('[movePage] error:', e)
      set(state => setTree(prev, state.showDeleted))
      set({ saveStatus: 'error' })
    }
  },

  async bulkOperation(payload: BulkOperationPayload) {
    set({ saveStatus: 'saving' })
    try {
      const res = await fetch('/api/pages/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed')
      const { pages }: { pages: Page[]; updated_count: number } = await res.json()
      // Merge updated pages into store
      const updatedMap = new Map(pages.map(p => [p.id, p]))
      set(state => setTree(
        state.pages.map(p => updatedMap.get(p.id) ?? p).filter(p =>
          payload.action !== 'delete' || !payload.page_ids.includes(p.id)
        ),
        state.showDeleted
      ))
      set({ saveStatus: 'saved' })
      setTimeout(() => set({ saveStatus: 'idle' }), 3000)
    } catch {
      set({ saveStatus: 'error' })
    }
  },

  async importApply(payload: ImportApplyPayload) {
    const res = await fetch('/api/import/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Import failed')
    const result: ImportApplyResult = await res.json()
    // Reload pages after import
    await get().loadPages(payload.account_id)
    return result
  },

  handleRemotePageChange(event: 'INSERT' | 'UPDATE' | 'DELETE', page: Page) {
    set(state => {
      let pages: Page[]
      if (event === 'INSERT') {
        pages = [...state.pages, page]
      } else if (event === 'UPDATE') {
        pages = state.pages.map(p => p.id === page.id ? page : p)
      } else {
        pages = state.pages.filter(p => p.id !== page.id)
      }
      return setTree(pages, state.showDeleted)
    })
  },
}))
