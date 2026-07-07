import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyAccountAccess } from '@/lib/utils/auth'

// Returns a {user_id: display_name} map for all users relevant to an account:
// members in user_accounts + anyone who has updated_by on a page in this account.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('account_id')
  if (!accountId) return NextResponse.json({ error: 'account_id required' }, { status: 400 })

  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hasAccess = await verifyAccountAccess(supabase, user.id, accountId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [membersRes, editorsRes] = await Promise.all([
    supabase.from('user_accounts').select('user_id').eq('account_id', accountId),
    supabase.from('pages').select('updated_by, created_by').eq('account_id', accountId),
  ])

  const userIdSet = new Set<string>()
  for (const r of membersRes.data ?? []) userIdSet.add(r.user_id)
  for (const r of editorsRes.data ?? []) {
    if (r.updated_by) userIdSet.add(r.updated_by)
    if (r.created_by) userIdSet.add(r.created_by)
  }

  const userIds = [...userIdSet]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])

  const map: Record<string, string> = {}
  for (const p of profiles ?? []) map[p.id] = p.display_name
  return NextResponse.json(map)
}
