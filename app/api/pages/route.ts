import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyAccountAccess } from '@/lib/utils/auth'
import { normalizeUrl } from '@/lib/utils/url'
import { logActivity } from '@/lib/utils/activity'
import type { Page } from '@/types'

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
    .from('pages')
    .select('*')
    .eq('account_id', accountId)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { account_id, parent_id, name, url, color, template, status, notes, sort_order } = body

  if (!account_id || !name) return NextResponse.json({ error: 'account_id and name required' }, { status: 400 })

  const hasAccess = await verifyAccountAccess(supabase, user.id, account_id)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch account domain for URL normalization
  const { data: account } = await supabase
    .from('accounts')
    .select('domain')
    .eq('id', account_id)
    .single()

  const url_normalized = url ? normalizeUrl(url, account?.domain ?? undefined) : null

  const row: Partial<Page> & { account_id: string; created_by: string; updated_by: string } = {
    account_id,
    parent_id: parent_id ?? null,
    name,
    url: url ?? null,
    url_normalized,
    color: color ?? null,
    template: template ?? null,
    status: status ?? 'planned',
    notes: notes ?? null,
    sort_order: sort_order ?? 0,
    created_by: user.id,
    updated_by: user.id,
  }

  const { data, error } = await supabase.from('pages').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  await logActivity(supabase, {
    account_id,
    user_id: user.id,
    user_name: profile?.display_name ?? user.id,
    action: 'page_created',
    entity_type: 'page',
    entity_id: data.id,
    entity_name: data.name,
  })

  return NextResponse.json(data, { status: 201 })
}
