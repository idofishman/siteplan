import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyAccountAccess } from '@/lib/utils/auth'
import { parseSitemapContent } from '@/lib/utils/importParser'
import { buildImportPlan } from '@/lib/utils/importEngine'

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
  const content = await file.text()

  const parsed = parseSitemapContent(content, account?.domain ?? undefined)
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
