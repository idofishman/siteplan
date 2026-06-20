import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyAccountAccess } from '@/lib/utils/auth'
import { parseSitemapContent, parseXlsxRows } from '@/lib/utils/importParser'
import { buildImportPlan } from '@/lib/utils/importEngine'
import type { ParseResult } from '@/lib/utils/importParser'

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const accountId = formData.get('account_id') as string
  const file = formData.get('file') as File | null

  if (!accountId) return NextResponse.json({ error: 'account_id required' }, { status: 400 })
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })

  const hasAccess = await verifyAccountAccess(supabase, user.id, accountId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: account } = await supabase.from('accounts').select('domain').eq('id', accountId).single()
  const domain = account?.domain ?? undefined

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  let parsed: ParseResult

  if (ext === 'xlsx') {
    // Dynamic import keeps xlsx out of the client bundle
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return NextResponse.json({ error: 'קובץ XLSX ריק' }, { status: 400 })
    const sheet = workbook.Sheets[sheetName]
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    parsed = parseXlsxRows(rows, domain)
  } else {
    const content = await file.text()
    parsed = parseSitemapContent(content, domain)
  }

  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  if (parsed.urls.length === 0) {
    return NextResponse.json({ error: 'לא נמצאו כתובות URL בקובץ' }, { status: 400 })
  }

  const { data: existingPages } = await supabase
    .from('pages')
    .select('id, name, url_normalized')
    .eq('account_id', accountId)

  const plan = buildImportPlan(parsed.urls, existingPages ?? [])

  return NextResponse.json({ fileType: parsed.type, plan })
}
