'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAccountStore } from '@/stores/accountStore'
import { useUiStore } from '@/stores/uiStore'
import { useTreeStore } from '@/stores/treeStore'
import type { PageNode } from '@/types'
import { AccountSwitcher } from '@/components/account/AccountSwitcher'
import { PresenceBar } from '@/components/presence/PresenceBar'
import { LastEdited } from '@/components/ui/LastEdited'
import { ImportModal } from '@/components/modals/ImportModal'
import { ImportPreviewModal } from '@/components/modals/ImportPreviewModal'
import { PageHistoryModal } from '@/components/modals/PageHistoryModal'
import { ContextMenu } from '@/components/tree/ContextMenu'
import { signOut } from '@/app/login/actions'
import type { Profile } from '@/types'
import pkg from '../../package.json'

const NAV_TABS = [
  { href: '/app', label: 'מפה', exact: true },
  { href: '/app/activity', label: 'פעילות', exact: false },
  { href: '/app/snapshots', label: 'צלמיות', exact: false },
  { href: '/app/gsc', label: 'כתובות חסרות', exact: false },
]

function serializeNode(node: PageNode): Record<string, unknown> {
  return {
    name: node.name,
    url: node.url ?? undefined,
    template: node.template ?? undefined,
    status: node.status,
    color: node.color ?? undefined,
    notes: node.notes ?? undefined,
    children: node.children.length > 0 ? node.children.map(serializeNode) : undefined,
  }
}

function exportSitemap(tree: PageNode[], slug: string) {
  const data = tree.map(serializeNode)
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug}-sitemap-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { activeAccount, loadAccounts, setActiveAccount } = useAccountStore()
  const { openModal } = useUiStore()
  const { tree, gscClicks } = useTreeStore()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([
      loadAccounts(),
      fetch('/api/me').then(r => r.ok ? r.json() : null),
    ]).then(([accs, me]) => {
      if (me) setProfile(me)

      if (accs.length === 0) {
        router.replace('/select-account')
        return
      }

      // If no active account yet, determine which one to use
      if (!useAccountStore.getState().activeAccount) {
        if (accs.length === 1) {
          setActiveAccount(accs[0])
        } else {
          // Multiple accounts, none selected → go to selector
          router.replace('/select-account')
          return
        }
      }

      setReady(true)
    })
  }, [])

  if (!ready || !activeAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-200">מנהל מבנה האתר</span>
          <span className="text-xs text-slate-500 font-mono">v{pkg.version}</span>
          <span className="text-slate-600">|</span>
          <AccountSwitcher />
          <LastEdited accountId={activeAccount.id} />
        </div>
        <div className="flex items-center gap-4">
          {profile && (
            <Link href="/app/profile" className="text-sm text-slate-300 hover:text-white transition-colors">
              {profile.display_name}
            </Link>
          )}
          {profile?.role === 'system_admin' && (
            <a href="/admin" className="text-sm text-slate-300 hover:text-white transition-colors">
              ניהול
            </a>
          )}
          <form action={signOut}>
            <button type="submit" className="text-sm text-slate-300 hover:text-white transition-colors">
              התנתק
            </button>
          </form>
        </div>
      </header>

      <PresenceBar />

      {/* Navigation tabs + import button */}
      <nav className="bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
        <div className="flex gap-1">
          {NAV_TABS.map(tab => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
            const hasGscData = Object.keys(gscClicks).length > 0
            const isGscTab = tab.href === '/app/gsc'
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`text-sm px-3 py-2.5 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  active
                    ? 'border-blue-500 text-blue-600 font-medium'
                    : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {tab.label}
                {isGscTab && (
                  <span
                    title={hasGscData ? 'נתוני GSC מיובאים' : 'לא יובאו נתוני GSC'}
                    className={`inline-block w-2 h-2 rounded-full shrink-0 ${hasGscData ? 'bg-green-400' : 'bg-red-400'}`}
                  />
                )}
              </Link>
            )
          })}
        </div>
        <div className="flex items-center gap-2 my-1">
          <button
            onClick={() => exportSitemap(tree, activeAccount.slug)}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors"
            title="ייצא מפת אתר ל-JSON"
          >
            ייצא JSON
          </button>
          <button
            onClick={() => openModal('import', {})}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors"
          >
            ייבא נתונים
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-auto">{children}</main>

      {/* Modals and overlays — rendered at layout level */}
      <ImportModal onPlanReady={() => {}} />
      <ImportPreviewModal />
      <PageHistoryModal />
      <ContextMenu />
    </div>
  )
}
