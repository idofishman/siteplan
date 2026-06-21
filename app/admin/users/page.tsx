'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { Account } from '@/types'

interface UserRow {
  id: string
  display_name: string
  role: string
  email: string | null
  created_at: string
  is_banned: boolean
  is_confirmed: boolean
  account_ids: string[]
}

const ROLES: { value: string; label: string }[] = [
  { value: 'system_admin', label: 'מנהל מערכת' },
  { value: 'user', label: 'משתמש' },
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)

  async function load() {
    const [usersRes, accsRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/accounts'),
    ])
    if (usersRes.ok) setUsers(await usersRes.json())
    if (accsRes.ok) setAccounts(await accsRes.json())
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

  async function handleNameSave(id: string, display_name: string) {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name }),
    })
    setUsers(prev => prev.map(u => u.id === id ? { ...u, display_name } : u))
  }

  async function handleToggleStatus(id: string) {
    const res = await fetch(`/api/admin/users/${id}?action=toggle-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.ok) {
      const { is_banned } = await res.json()
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_banned } : u))
    }
  }

  async function handleResetPassword(id: string, email: string | null) {
    const res = await fetch(`/api/admin/users/${id}?action=reset-password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.ok) {
      const { link } = await res.json()
      if (link) {
        await navigator.clipboard.writeText(link)
        alert(`לינק לאיפוס סיסמה עבור ${email ?? id} הועתק ללוח`)
      } else {
        alert('לא ניתן לייצר לינק איפוס')
      }
    } else {
      alert('שגיאה בייצור לינק איפוס')
    }
  }

  async function handleResendInvite(id: string, email: string | null) {
    const res = await fetch(`/api/admin/users/${id}?action=resend-invite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.ok) alert(`הזמנה נשלחה מחדש אל ${email ?? id}`)
    else alert('שגיאה בשליחת הזמנה')
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`למחוק את המשתמש "${name}"? פעולה זו אינה הפיכה.`)) return
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    if (res.ok) setUsers(prev => prev.filter(u => u.id !== id))
    else alert('שגיאה במחיקה')
  }

  async function handleAccountAssign(userId: string, accountIds: string[]) {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_ids: accountIds }),
    })
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, account_ids: accountIds } : u))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">משתמשים ({users.length})</h1>
        <button
          onClick={() => setInviteOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + הזמן משתמש
        </button>
      </div>

      {inviteOpen && (
        <InviteForm
          onClose={() => setInviteOpen(false)}
          onInvited={() => { setInviteOpen(false); load() }}
        />
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          accounts={accounts}
          onClose={() => setEditUser(null)}
          onSaved={updated => {
            setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
            setEditUser(null)
          }}
        />
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">שם</th>
              <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">אימייל</th>
              <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">תפקיד</th>
              <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">סטטוס</th>
              <th className="text-start px-4 py-3 text-xs font-medium text-slate-500">חשבונות</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <React.Fragment key={u.id}>
                <tr
                  className={`border-b border-slate-100 hover:bg-slate-50 ${u.is_banned ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3">
                    <InlineNameEdit
                      name={u.display_name}
                      onSave={name => handleNameSave(u.id, name)}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs" dir="ltr">
                    <span>{u.email ?? '—'}</span>
                    {!u.is_confirmed && (
                      <span className="mr-2 text-amber-600 bg-amber-50 border border-amber-200 text-[10px] px-1.5 py-0.5 rounded-full font-medium">ממתין לאישור</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                    >
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleStatus(u.id)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                        u.is_banned
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {u.is_banned ? 'חסום' : 'פעיל'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      {u.account_ids.length} חשבונות
                      <svg className={`w-3 h-3 transition-transform ${expandedId === u.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex items-center justify-end gap-2">
                      {!u.is_confirmed && (
                        <button
                          onClick={() => handleResendInvite(u.id, u.email)}
                          className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                        >
                          שלח שוב
                        </button>
                      )}
                      <button
                        onClick={() => setEditUser(u)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        עריכה
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.display_name)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        מחק
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === u.id && (
                  <tr key={`${u.id}-accounts`} className="border-b border-slate-100 bg-slate-50">
                    <td colSpan={6} className="px-6 py-3">
                      <AccountAssignment
                        userId={u.id}
                        assignedIds={u.account_ids}
                        accounts={accounts}
                        onSave={ids => handleAccountAssign(u.id, ids)}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InlineNameEdit({ name, onSave }: { name: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  function start() {
    setValue(name)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function save() {
    setEditing(false)
    if (value.trim() && value.trim() !== name) onSave(value.trim())
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className="text-sm border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 w-40"
      />
    )
  }

  return (
    <span
      onClick={start}
      className="font-medium text-slate-800 cursor-pointer hover:text-blue-700 hover:underline"
      title="לחץ לעריכה"
    >
      {name}
    </span>
  )
}

function AccountAssignment({
  userId,
  assignedIds,
  accounts,
  onSave,
}: {
  userId: string
  assignedIds: string[]
  accounts: Account[]
  onSave: (ids: string[]) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedIds))
  const [saving, setSaving] = useState(false)

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)
    await onSave([...selected])
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-slate-500">גישה לחשבונות:</p>
      <div className="flex flex-wrap gap-3">
        {accounts.map(acc => (
          <label key={acc.id} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected.has(acc.id)}
              onChange={() => toggle(acc.id)}
              className="accent-blue-600"
            />
            {acc.name}
          </label>
        ))}
        {accounts.length === 0 && <span className="text-xs text-slate-400">אין חשבונות</span>}
      </div>
      <div>
        <button
          onClick={save}
          disabled={saving}
          className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-3 py-1 rounded-lg transition-colors"
        >
          {saving ? 'שומר...' : 'שמור שיוכים'}
        </button>
      </div>
    </div>
  )
}

function EditUserModal({
  user,
  accounts,
  onClose,
  onSaved,
}: {
  user: UserRow
  accounts: Account[]
  onClose: () => void
  onSaved: (updated: UserRow) => void
}) {
  const [displayName, setDisplayName] = useState(user.display_name)
  const [role, setRole] = useState(user.role)
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set(user.account_ids))
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [localBanned, setLocalBanned] = useState(user.is_banned)
  const [error, setError] = useState<string | null>(null)
  const [resetMsg, setResetMsg] = useState<string | null>(null)

  function toggleAccount(id: string) {
    setSelectedAccounts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const account_ids = [...selectedAccounts]

    const [profileRes, accountRes] = await Promise.all([
      fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName, role }),
      }),
      fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_ids }),
      }),
    ])

    if (!profileRes.ok || !accountRes.ok) {
      setError('שגיאה בשמירה')
      setSaving(false)
      return
    }

    onSaved({ ...user, display_name: displayName, role, account_ids, is_banned: localBanned })
  }

  async function handleToggleStatus() {
    setTogglingStatus(true)
    const res = await fetch(`/api/admin/users/${user.id}?action=toggle-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.ok) {
      const { is_banned } = await res.json()
      setLocalBanned(is_banned)
    }
    setTogglingStatus(false)
  }

  async function handleResetPassword() {
    setResetting(true)
    setResetMsg(null)
    const res = await fetch(`/api/admin/users/${user.id}?action=reset-password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.ok) {
      const { link } = await res.json()
      if (link) {
        await navigator.clipboard.writeText(link)
        setResetMsg('לינק איפוס הועתק ללוח')
      } else {
        setResetMsg('לא ניתן לייצר לינק איפוס')
      }
    } else {
      setResetMsg('שגיאה בייצור לינק')
    }
    setResetting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">עריכת משתמש</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-5">
          {/* Email (read-only) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">אימייל</label>
            <p className="text-sm text-slate-700 font-mono bg-slate-50 px-3 py-2 rounded-lg" dir="ltr">
              {user.email ?? '—'}
            </p>
          </div>

          {/* Display name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">שם תצוגה</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">תפקיד</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">סטטוס</p>
              <p className="text-sm text-slate-700 mt-0.5">{localBanned ? 'חסום' : 'פעיל'}</p>
            </div>
            <button
              onClick={handleToggleStatus}
              disabled={togglingStatus}
              className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${
                localBanned
                  ? 'bg-green-100 hover:bg-green-200 text-green-700'
                  : 'bg-red-100 hover:bg-red-200 text-red-700'
              }`}
            >
              {togglingStatus ? '...' : localBanned ? 'בטל חסימה' : 'חסום משתמש'}
            </button>
          </div>

          {/* Resend invite — only for unconfirmed users */}
          {!user.is_confirmed && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-xs font-medium text-amber-700">ממתין לאישור הזמנה</p>
                {resendMsg && <p className="text-xs text-green-600 mt-0.5">{resendMsg}</p>}
              </div>
              <button
                onClick={async () => {
                  setResending(true); setResendMsg(null)
                  const res = await fetch(`/api/admin/users/${user.id}?action=resend-invite`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
                  })
                  setResendMsg(res.ok ? 'הזמנה נשלחה מחדש ✓' : 'שגיאה בשליחה')
                  setResending(false)
                }}
                disabled={resending}
                className="text-sm px-4 py-1.5 rounded-lg font-medium bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors"
              >
                {resending ? 'שולח...' : 'שלח הזמנה מחדש'}
              </button>
            </div>
          )}

          {/* Reset password */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">סיסמה</p>
              {resetMsg && <p className="text-xs text-green-600 mt-0.5">{resetMsg}</p>}
            </div>
            <button
              onClick={handleResetPassword}
              disabled={resetting}
              className="text-sm px-4 py-1.5 rounded-lg font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              {resetting ? 'מייצר...' : 'שלח לינק איפוס סיסמה'}
            </button>
          </div>

          {/* Account assignment */}
          {accounts.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">גישה לחשבונות</label>
              <div className="flex flex-wrap gap-3 bg-slate-50 rounded-lg p-3">
                {accounts.map(acc => (
                  <label key={acc.id} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedAccounts.has(acc.id)}
                      onChange={() => toggleAccount(acc.id)}
                      className="accent-blue-600"
                    />
                    {acc.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-slate-200 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'שומר...' : 'שמור שינויים'}
          </button>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}

function InviteForm({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('user')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, display_name: displayName, role }),
    })
    if (res.ok) {
      onInvited()
    } else {
      const data = await res.json()
      setError(data.error ?? 'שגיאה בשליחת הזמנה')
      setLoading(false)
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
      <h3 className="font-medium text-slate-800 mb-3 text-sm">הזמן משתמש חדש</h3>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">אימייל *</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="user@example.com"
            dir="ltr"
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 w-56 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">שם תצוגה</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="שם מלא"
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">תפקיד</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            {loading ? 'שולח...' : 'שלח הזמנה'}
          </button>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">
            ביטול
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
