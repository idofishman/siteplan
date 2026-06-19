import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireSystemAdmin } from '@/lib/utils/auth'
import { logActivity } from '@/lib/utils/activity'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = await requireSystemAdmin(supabase, user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const allowed: Record<string, unknown> = {}
  if (body.name !== undefined) allowed.name = body.name
  if (body.domain !== undefined) allowed.domain = body.domain
  if (body.status !== undefined) allowed.status = body.status

  const { error } = await supabase.from('accounts').update(allowed).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// POST /api/admin/accounts/[id]/clear-sitemap would be a sub-route, so we handle a special action via query
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = await requireSystemAdmin(supabase, user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'clear-sitemap') {
    // Two-step: verification token in body
    const { confirm_token, account_name } = await request.json()
    if (confirm_token !== 'DELETE') return NextResponse.json({ error: 'Confirmation token invalid' }, { status: 400 })

    const adminSupa = createServiceRoleClient()
    const { error } = await adminSupa.from('pages').delete().eq('account_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
    await logActivity(supabase, {
      account_id: params.id,
      user_id: user.id,
      user_name: profile?.display_name ?? user.id,
      action: 'sitemap_cleared',
      details: { account_name },
    })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
