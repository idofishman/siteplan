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

  // Also get auth email via service role
  const adminSupa = createServiceRoleClient()
  const { data: authUsers } = await adminSupa.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map(authUsers?.users?.map(u => [u.id, u.email]) ?? [])

  const result = (data ?? []).map(p => ({ ...p, email: emailMap.get(p.id) ?? null }))
  return NextResponse.json(result)
}
