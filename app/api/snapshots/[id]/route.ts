import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyAccountAccess } from '@/lib/utils/auth'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: snapshot } = await supabase
    .from('snapshots')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!snapshot) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const hasAccess = await verifyAccountAccess(supabase, user.id, snapshot.account_id)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(snapshot)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: snapshot } = await supabase
    .from('snapshots')
    .select('account_id, name')
    .eq('id', params.id)
    .single()

  if (!snapshot) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const hasAccess = await verifyAccountAccess(supabase, user.id, snapshot.account_id)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('snapshots').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
