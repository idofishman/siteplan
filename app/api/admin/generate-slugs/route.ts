import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/utils/auth'

function extractSlug(url: string | null): string | null {
  if (!url) return null
  try {
    const path = url.startsWith('http') ? new URL(url).pathname : url
    const segments = path.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    if (!last) return null
    return last.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || null
  } catch {
    return null
  }
}

// POST: create snapshot backup, then populate new_url slugs for all pages missing them
export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = await requireAdmin(supabase, user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { account_id, overwrite = false } = await request.json()
  if (!account_id) return NextResponse.json({ error: 'account_id required' }, { status: 400 })

  const adminSupa = createServiceRoleClient()

  // 1. Create backup snapshot
  const { data: allPagesForSnapshot } = await adminSupa
    .from('pages')
    .select('*')
    .eq('account_id', account_id)
    .eq('is_deleted', false)

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  const { error: snapError } = await adminSupa.from('snapshots').insert({
    account_id,
    name: `לפני יצירת slugs אוטומטית — ${new Date().toLocaleString('he-IL')}`,
    created_by: user.id,
    created_by_name: profile?.display_name ?? 'מערכת',
    page_count: allPagesForSnapshot?.length ?? 0,
    data: allPagesForSnapshot ?? [],
  })

  if (snapError) return NextResponse.json({ error: `Snapshot failed: ${snapError.message}` }, { status: 500 })

  // 2. Fetch pages to update
  const { data: pages, error: pagesError } = await adminSupa
    .from('pages')
    .select('id, url, new_url')
    .eq('account_id', account_id)
    .eq('is_deleted', false)

  if (pagesError) return NextResponse.json({ error: pagesError.message }, { status: 500 })

  const toUpdate = (pages ?? []).filter(p => overwrite ? true : !p.new_url)

  let updated = 0
  let skipped = 0

  for (const p of toUpdate) {
    const slug = extractSlug(p.url)
    if (!slug) { skipped++; continue }

    const { error } = await adminSupa
      .from('pages')
      .update({ new_url: slug })
      .eq('id', p.id)

    if (!error) updated++
    else skipped++
  }

  return NextResponse.json({
    ok: true,
    snapshot_created: true,
    updated,
    skipped,
    total: toUpdate.length,
  })
}

// GET: preview what slugs would be generated (dry run, no changes)
export async function GET(request: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = await requireAdmin(supabase, user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('account_id')
  if (!accountId) return NextResponse.json({ error: 'account_id required' }, { status: 400 })

  const { data: pages } = await supabase
    .from('pages')
    .select('id, name, url, new_url')
    .eq('account_id', accountId)
    .eq('is_deleted', false)

  const preview = (pages ?? []).map(p => ({
    id: p.id,
    name: p.name,
    current_url: p.url,
    existing_slug: p.new_url,
    generated_slug: extractSlug(p.url),
    would_update: !p.new_url,
  }))

  return NextResponse.json({ preview, total: preview.length, to_update: preview.filter(p => p.would_update).length })
}
