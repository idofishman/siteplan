'use client'

import { useState, useCallback, useRef } from 'react'
import { useTreeStore } from '@/stores/treeStore'


export function TreeSearch() {
  const [query, setQuery] = useState('')
  const { pages } = useTreeStore()
const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('')
      inputRef.current?.blur()
    }
  }, [])

  const results = query.trim().length >= 2
    ? pages.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.url?.toLowerCase().includes(query.toLowerCase())
      )
    : []

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="חיפוש עמוד..."
        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white"
        aria-label="חיפוש עמודים"
      />
      {results.length > 0 && (
        <div className="absolute top-full mt-1 start-0 end-0 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-64 overflow-y-auto">
          {results.map(p => (
            <button
              key={p.id}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-start hover:bg-slate-50 border-b border-slate-100 last:border-0"
              onClick={() => {
                setQuery('')
                // Scroll to the element
                const el = document.getElementById(`page-node-${p.id}`)
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el?.focus()
              }}
            >
              <span className="text-slate-700 font-medium flex-1 truncate">{p.name}</span>
              {p.url && <span className="text-slate-400 text-xs truncate max-w-[140px]" dir="ltr">{p.url}</span>}
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute top-full mt-1 start-0 end-0 bg-white border border-slate-200 rounded-xl shadow-sm z-30 px-3 py-2">
          <p className="text-sm text-slate-400">לא נמצאו תוצאות</p>
        </div>
      )}
    </div>
  )
}
