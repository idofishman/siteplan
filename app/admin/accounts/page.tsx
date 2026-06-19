'use client'

import { useState, useEffect } from 'react'
import { ClearSitemapModal } from '@/components/modals/ClearSitemapModal'

interface AccountRow {
  id: string
  name: string
  domain: string | null
  is_active: boolean
  created_at: string
}

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [clearTarget, setClearTarget] = useState<AccountRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDomain, setNewDomain] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/admin/accounts')
    if (res.ok) setAccounts(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleToggleStatus(account: AccountRow) {
    const nextActive = !account.is_active
    await fetch(`/api/admin/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: nextActive }),
    })
    setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, is_active: nextActive } : a))
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    setCreateError(null)
    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, domain: newDomain }),
    })
    if (res.ok) {
      const acc = await res.json()
      setAccounts(prev => [acc, ...prev])
      setNewName('')
      setNewDomain('')
    } else {
      const { error } = await res.json()
      setCreateError(error ?? 'שגיאה ביצירת חשבון')
    }
    setCreating(false)
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-6">חשבונות ({accounts.length})</h1>

        {/* Create account */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">שם חשבון</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="שם החברה"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">דומיין (אופציונלי)</label>
            <input
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              placeholder="example.com"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              dir="ltr"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {creating ? 'יוצר...' : 'צור חשבון'}
          </button>
          {createError && <p className="text-sm text-red-600 w-full">{createError}</p>}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">שם</th>
                <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">דומיין</th>
                <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">סטטוס</th>
                <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">נוצר</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{a.name}</td>
                  <td className="px-4 py-3 text-slate-500" dir="ltr">{a.domain ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleStatus(a)}
                      className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                        a.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {a.is_active ? 'פעיל' : 'לא פעיל'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(a.created_at).toLocaleDateString('he-IL')}</td>
                  <td className="px-4 py-3 text-end">
                    <button
                      onClick={() => setClearTarget(a)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      נקה מפת אתר
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {clearTarget && (
        <ClearSitemapModal
          accountId={clearTarget.id}
          accountName={clearTarget.name}
          open={!!clearTarget}
          onClose={() => setClearTarget(null)}
          onCleared={() => setClearTarget(null)}
        />
      )}
    </div>
  )
}
