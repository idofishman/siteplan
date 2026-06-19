'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin', label: 'סקירה' },
  { href: '/admin/users', label: 'משתמשים' },
  { href: '/admin/accounts', label: 'חשבונות' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/app" className="text-sm text-slate-500 hover:text-slate-700">
            ← חזרה לאפליקציה
          </Link>
          <span className="text-sm font-bold text-slate-800">לוח ניהול</span>
          <nav className="flex gap-1 mr-4">
            {NAV.map(n => (
              <Link
                key={n.href}
                href={n.href}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  pathname === n.href
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
