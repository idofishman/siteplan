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
  const period = (formData.get('period') as string | null) ?? null // stored in activity log only

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
    const urlOriginal = col(parts, 'page') || col(parts, 'url') || col(parts, 'top pages') || col(parts, 'landing page')
    if (!urlOriginal) continue
    const normalized = normalizeUrl(urlOriginal, account?.domain ?? undefined)
    if (!normalized) continue

    const ctrRaw = col(parts, 'ctr').replace('%', '')
    const ctrVal = parseFloat(ctrRaw)
    // GSC exports CTR as percentage string ("28.15%") — store as decimal (0–1)
    const ctr = isNaN(ctrVal) ? null : ctrVal > 1 ? ctrVal / 100 : ctrVal

    rows.push({
      url_original: urlOriginal,
      url_normalized: normalized,
      clicks: parseInt(col(parts, 'clicks') || col(parts, 'url clicks'), 10) || 0,
      impressions: parseInt(col(parts, 'impressions'), 10) || null,
      ctr,
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

  if (uniqueRows.length === 0) {
    return NextResponse.json({ error: 'לא נמצאו נתונים תקינים בקובץ — ודא שקיימת עמודת URL (page / landing page / top pages)' }, { status: 400 })
  }

  const adminSupa = createServiceRoleClient()

  // Backup existing data so we can restore if the insert fails
  const { data: backup } = await adminSupa.from('gsc_clicks').select('*').eq('account_id', accountId)

  const { error: deleteErr } = await adminSupa.from('gsc_clicks').delete().eq('account_id', accountId)
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  const insertRows = uniqueRows.map(r => ({ ...r, account_id: accountId, uploaded_by: user.id }))
  const { error: insertErr } = await adminSupa.from('gsc_clicks').insert(insertRows)
  if (insertErr) {
    // Restore backup so previous data is not lost
    if (backup && backup.length > 0) {
      await adminSupa.from('gsc_clicks').insert(backup)
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
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
    .limit(50000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
