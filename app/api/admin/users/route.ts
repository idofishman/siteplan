import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/utils/auth'

export async function GET() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!myProfile || (myProfile.role !== 'system_admin' && myProfile.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isSuperAdmin = myProfile.role === 'system_admin'

  // For regular admin: find the accounts they belong to, then scope the user list to those accounts only
  let allowedUserIds: Set<string> | null = null
  if (!isSuperAdmin) {
    const { data: myAccounts } = await supabase
      .from('user_accounts')
      .select('account_id')
      .eq('user_id', user.id)
    const myAccountIds = (myAccounts ?? []).map(r => r.account_id)

    if (myAccountIds.length === 0) {
      // Admin with no accounts — return empty list
      return NextResponse.json([])
    }

    const { data: accountMembers } = await supabase
      .from('user_accounts')
      .select('user_id')
      .in('account_id', myAccountIds)
    allowedUserIds = new Set((accountMembers ?? []).map(r => r.user_id))
    // Always include self
    allowedUserIds.add(user.id)
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, role, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const adminSupa = createServiceRoleClient()
  const { data: authUsers } = await adminSupa.auth.admin.listUsers({ perPage: 1000 })

  const now = new Date()
  const authMap = new Map(
    authUsers?.users?.map(u => [
      u.id,
      {
        email: u.email ?? null,
        is_banned: !!(u.banned_until && new Date(u.banned_until) > now),
        is_confirmed: !!(u.email_confirmed_at || u.confirmed_at),
      },
    ]) ?? []
  )

  // Get account assignments
  const { data: userAccounts } = await supabase
    .from('user_accounts')
    .select('user_id, account_id')

  const accountsMap = new Map<string, string[]>()
  for (const ua of userAccounts ?? []) {
    if (!accountsMap.has(ua.user_id)) accountsMap.set(ua.user_id, [])
    accountsMap.get(ua.user_id)!.push(ua.account_id)
  }

  const profiles = allowedUserIds
    ? (data ?? []).filter(p => allowedUserIds!.has(p.id))
    : (data ?? [])

  const result = profiles.map(p => ({
    ...p,
    email: authMap.get(p.id)?.email ?? null,
    is_banned: authMap.get(p.id)?.is_banned ?? false,
    is_confirmed: authMap.get(p.id)?.is_confirmed ?? true,
    account_ids: accountsMap.get(p.id) ?? [],
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = await requireAdmin(supabase, user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { email, display_name, role } = body

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const adminSupa = createServiceRoleClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const { data, error } = await adminSupa.auth.admin.generateLink({
    type: 'invite',
    email,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userId = data?.user?.id
  // Build our own confirm URL so redirect never goes through Supabase's allowlist check
  const rawLink = data?.properties?.action_link ?? null
  const token = rawLink ? new URL(rawLink).searchParams.get('token') : null
  const link = token
    ? (() => { const u = new URL(`${siteUrl}/auth/confirm`); u.searchParams.set('token_hash', token); u.searchParams.set('type', 'invite'); return u.toString() })()
    : null

  // Ensure profile row exists
  if (userId) {
    await adminSupa
      .from('profiles')
      .upsert({
        id: userId,
        display_name: display_name ?? '',
        role: role ?? 'user',
      }, { onConflict: 'id', ignoreDuplicates: true })
  }

  return NextResponse.json({ ok: true, id: userId, link })
}

