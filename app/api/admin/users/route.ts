import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireSystemAdmin } from '@/lib/utils/auth'

export async function GET() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = await requireSystemAdmin(supabase, user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

  const result = (data ?? []).map(p => ({
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

  const isAdmin = await requireSystemAdmin(supabase, user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { email, display_name, role } = body

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const adminSupa = createServiceRoleClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  // Use generateLink to avoid Supabase email rate limits.
  // The admin copies the returned link and sends it to the user manually.
  const { data, error } = await adminSupa.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo: `${siteUrl}/app` },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userId = data?.user?.id
  const link = data?.properties?.action_link ?? null

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
