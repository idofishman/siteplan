import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = createServerClient()

  const [
    { count: userCount },
    { count: accountCount },
    { count: pageCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('pages').select('*', { count: 'exact', head: true }),
  ])

  const stats = [
    { label: 'משתמשים', value: userCount ?? 0, href: '/admin/users' },
    { label: 'חשבונות פעילים', value: accountCount ?? 0, href: '/admin/accounts' },
    { label: 'עמודים (סה"כ)', value: pageCount ?? 0, href: null },
  ]

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-6">סקירה כללית</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-sm text-slate-500 mb-1">{s.label}</p>
            <p className="text-3xl font-bold text-slate-800">{s.value.toLocaleString('he-IL')}</p>
            {s.href && (
              <Link href={s.href} className="text-xs text-blue-600 hover:underline mt-2 block">
                צפה בכל →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
