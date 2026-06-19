import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyAccountAccess } from '@/lib/utils/auth'
import { logActivity } from '@/lib/utils/activity'
import type { ImportUrlPlan } from '@/lib/utils/importEngine'

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, urls }: { account_id: string; urls: ImportUrlPlan[] } = await request.json()
  if (!account_id || !urls?.length) return NextResponse.json({ error: 'account_id and urls required' }, { status: 400 })

  const hasAccess = await verifyAccountAccess(supabase, user.id, account_id)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  const displayName = profile?.display_name ?? user.id

  // Only insert the "add" ones
  const toAdd = urls.filter(u => u.action === 'add')
  if (toAdd.length === 0) return NextResponse.json({ inserted: 0 })

  // Get max sort_order
  const { data: existing } = await supabase
    .from('pages')
    .select('sort_order')
    .eq('account_id', account_id)
    .order('sort_order', { ascending: false })
    .limit(1)

  let sortOrder = (existing?.[0]?.sort_order ?? 0) + 1

  const newPages = toAdd.map(u => ({
    account_id,
    name: deriveNameFromUrl(u.url),
    url: u.url,
    url_normalized: u.url_normalized,
    status: 'draft' as const,
    sort_order: sortOrder++,
    created_by: user.id,
    updated_by: user.id,
  }))

  const { error } = await supabase.from('pages').insert(newPages)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(supabase, {
    account_id,
    user_id: user.id,
    user_name: displayName,
    action: 'import_applied',
    details: { inserted: toAdd.length, skipped: urls.length - toAdd.length },
  })

  return NextResponse.json({ inserted: toAdd.length })
}

function deriveNameFromUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length === 0) return 'דף הבית'
    const last = parts[parts.length - 1]
    return last
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\.(html?|php|aspx?)$/i, '')
      .trim() || 'עמוד'
  } catch {
    return 'עמוד'
  }
}
