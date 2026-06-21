import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireSystemAdmin } from '@/lib/utils/auth'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = await requireSystemAdmin(supabase, user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const action = new URL(request.url).searchParams.get('action')
  const adminSupa = createServiceRoleClient()

  if (action === 'reset-password') {
    const { data: authUser, error: getUserErr } = await adminSupa.auth.admin.getUserById(params.id)
    if (getUserErr || !authUser?.user?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const { data, error } = await adminSupa.auth.admin.generateLink({
      type: 'recovery',
      email: authUser.user.email,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ link: data?.properties?.action_link ?? null })
  }

  if (action === 'resend-invite') {
    const { data: authUser, error: getUserErr } = await adminSupa.auth.admin.getUserById(params.id)
    if (getUserErr || !authUser?.user?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const { error } = await adminSupa.auth.admin.inviteUserByEmail(authUser.user.email, {
      redirectTo: `${siteUrl}/app`,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'toggle-status') {
    const { data: authUser, error: getUserErr } = await adminSupa.auth.admin.getUserById(params.id)
    if (getUserErr) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const now = new Date()
    const isBanned = !!(authUser?.user?.banned_until && new Date(authUser.user.banned_until) > now)
    const { error } = await adminSupa.auth.admin.updateUserById(params.id, {
      ban_duration: isBanned ? 'none' : '876000h', // unban or ban for 100 years
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, is_banned: !isBanned })
  }

  const body = await request.json()

  // Handle account assignment replacement
  if (body.account_ids !== undefined) {
    await supabase.from('user_accounts').delete().eq('user_id', params.id)
    if (body.account_ids.length > 0) {
      const rows = (body.account_ids as string[]).map((account_id: string) => ({
        user_id: params.id,
        account_id,
      }))
      const { error } = await supabase.from('user_accounts').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // Standard profile update
  const allowed: Record<string, unknown> = {}
  if (body.display_name !== undefined) allowed.display_name = body.display_name
  if (body.role !== undefined) allowed.role = body.role

  if (Object.keys(allowed).length > 0) {
    const { error } = await supabase.from('profiles').update(allowed).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = await requireSystemAdmin(supabase, user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (params.id === user.id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })

  const adminSupa = createServiceRoleClient()
  const { error } = await adminSupa.auth.admin.deleteUser(params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
