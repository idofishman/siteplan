'use client'

import { useState, useEffect } from 'react'

interface UserRow {
  id: string
  display_name: string
  role: string
  email: string | null
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  system_admin: 'מנהל מערכת',
  account_admin: 'מנהל חשבון',
  editor: 'עורך',
  viewer: 'צופה',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/admin/users')
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleRoleChange(id: string, role: string) {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`למחוק את המשתמש "${name}"? פעולה זו אינה הפיכה.`)) return
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    if (res.ok) setUsers(prev => prev.filter(u => u.id !== id))
    else alert('שגיאה במחיקה')
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-6">משתמשים ({users.length})</h1>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">שם</th>
              <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">אימייל</th>
              <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">תפקיד</th>
              <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">הצטרפות</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{u.display_name}</td>
                <td className="px-4 py-3 text-slate-500" dir="ltr">{u.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value)}
                    className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                  >
                    {Object.entries(ROLE_LABELS).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString('he-IL')}</td>
                <td className="px-4 py-3 text-end">
                  <button
                    onClick={() => handleDelete(u.id, u.display_name)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    מחק
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
