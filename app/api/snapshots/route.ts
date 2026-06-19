import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyAccountAccess } from '@/lib/utils/auth'
import { logActivity } from '@/lib/utils/activity'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('account_id')
  if (!accountId) return NextResponse.json({ error: 'account_id required' }, { status: 400 })

  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hasAccess = await verifyAccountAccess(supabase, user.id, accountId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('snapshots')
    .select('id, account_id, name, created_by, created_by_name, created_at, page_count')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, name } = await request.json()
  if (!account_id) return NextResponse.json({ error: 'account_id required' }, { status: 400 })

  const hasAccess = await verifyAccountAccess(supabase, user.id, account_id)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  const displayName = profile?.display_name ?? user.id

  // Get all current pages for this account
  const { data: pages, error: pagesErr } = await supabase
    .from('pages')
    .select('*')
    .eq('account_id', account_id)

  if (pagesErr) return NextResponse.json({ error: pagesErr.message }, { status: 500 })

  const snapshotName = name?.trim() || `גיבוי ${new Date().toLocaleString('he-IL')}`

  const { data: snapshot, error } = await supabase.from('snapshots').insert({
    account_id,
    name: snapshotName,
    created_by: user.id,
    created_by_name: displayName,
    page_count: pages?.length ?? 0,
    data: pages ?? [],
  }).select('id, account_id, name, created_by, created_by_name, created_at, page_count').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(supabase, {
    account_id,
    user_id: user.id,
    user_name: displayName,
    action: 'snapshot_created',
    entity_type: 'snapshot',
    entity_id: snapshot.id,
    entity_name: snapshotName,
  })

  return NextResponse.json(snapshot, { status: 201 })
}
