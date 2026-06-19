import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  let accounts

  if (profile?.role === 'system_admin') {
    // System admin sees all active accounts
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    accounts = data
  } else {
    // Regular user: only assigned active accounts (RLS also enforces this)
    const { data, error } = await supabase
      .from('accounts')
      .select('*, user_accounts!inner(user_id)')
      .eq('user_accounts.user_id', user.id)
      .eq('is_active', true)
      .order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Strip the join field from the response
    accounts = data?.map(({ user_accounts: _ua, ...acc }) => acc)
  }

  return NextResponse.json(accounts ?? [])
}
