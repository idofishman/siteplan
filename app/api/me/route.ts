import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, role, created_at')
    .eq('id', user.id)
    .single()

  return NextResponse.json({ ...profile, email: user.email })
}

export async function PATCH(request: Request) {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { display_name } = body

  if (typeof display_name !== 'string' || !display_name.trim()) {
    return NextResponse.json({ error: 'Invalid display_name' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: display_name.trim() })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
