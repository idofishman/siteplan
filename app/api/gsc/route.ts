import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { verifyAccountAccess } from '@/lib/utils/auth'
import { normalizeUrl } from '@/lib/utils/url'
import { logActivity } from '@/lib/utils/activity'

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const accountId = formData.get('account_id') as string
  const file = formData.get('file') as File | null
  const period = (formData.get('period') as string | null) ?? null

  if (!accountId || !file) return NextResponse.json({ error: 'account_id and file required' }, { status: 400 })

  const hasAccess = await verifyAccountAccess(supabase, user.id, accountId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch account domain for URL normalization
  const { data: account } = await supabase
    .from('accounts')
    .select('domain')
    .eq('id', accountId)
    .single()

  // Parse CSV
  const text = await file.text()
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return NextResponse.json({ error: 'CSV must have at least a header row and one data row' }, { status: 400 })

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))

  function col(row: string[], name: string): string {
    const idx = headers.indexOf(name)
    return idx >= 0 ? (row[idx] ?? '').trim().replace(/"/g, '') : ''
  }

  const rows: Array<{
    url_original: string
    url_normalized: string
    clicks: number
    impressions: number | null
    ctr: number | null
    position: number | null
  }> = []

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',')
    const urlOriginal = col(parts, 'page') || col(parts, 'url') || col(parts, 'top pages')
    if (!urlOriginal) continue
    const normalized = normalizeUrl(urlOriginal, account?.domain ?? undefined)
    if (!normalized) continue

    rows.push({
      url_original: urlOriginal,
      url_normalized: normalized,
      clicks: parseInt(col(parts, 'clicks'), 10) || 0,
      impressions: parseInt(col(parts, 'impressions'), 10) || null,
      ctr: parseFloat(col(parts, 'ctr')) || null,
      position: parseFloat(col(parts, 'position')) || null,
    })
  }

  // Deduplicate by url_normalized — keep highest-clicks row for each URL
  const dedupMap = new Map<string, typeof rows[0]>()
  for (const row of rows) {
    const existing = dedupMap.get(row.url_normalized)
    if (!existing || row.clicks > existing.clicks) dedupMap.set(row.url_normalized, row)
  }
  const uniqueRows = Array.from(dedupMap.values())

  // Transactional: delete all for account, insert new
  const adminSupa = createServiceRoleClient()

  const { error: deleteErr } = await adminSupa.from('gsc_clicks').delete().eq('account_id', accountId)
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  if (uniqueRows.length > 0) {
    const insertRows = uniqueRows.map(r => ({ ...r, account_id: accountId, period, uploaded_by: user.id }))
    const { error: insertErr } = await adminSupa.from('gsc_clicks').insert(insertRows)
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  await logActivity(supabase, {
    account_id: accountId,
    user_id: user.id,
    user_name: profile?.display_name ?? user.id,
    action: 'gsc_uploaded',
    details: { file_name: file.name, record_count: uniqueRows.length, period },
  })

  return NextResponse.json({ inserted: uniqueRows.length })
}

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
    .from('gsc_clicks')
    .select('*')
    .eq('account_id', accountId)
    .order('clicks', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
