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
  if (body.is_active !== undefined) allowed.is_active = body.is_active

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
    const { confirm_token, account_name } = await request.json()
    if (confirm_token !== 'DELETE') return NextResponse.json({ error: 'Confirmation token invalid' }, { status: 400 })

    const adminSupa = createServiceRoleClient()

    // Fetch the admin's profile for activity log
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
    const displayName = profile?.display_name ?? user.id

    // 1. Fetch all current pages — needed for the backup snapshot
    const { data: currentPages, error: fetchErr } = await adminSupa
      .from('pages')
      .select('*')
      .eq('account_id', params.id)
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const pageCount = currentPages?.length ?? 0
    const snapshotName = `גיבוי לפני מחיקת מפה — ${account_name} — ${new Date().toLocaleDateString('he-IL')}`

    // 2. Create backup snapshot BEFORE deleting anything.
    //    If this fails, nothing is deleted and we return the error.
    const { data: backupSnapshot, error: snapshotErr } = await adminSupa
      .from('snapshots')
      .insert({
        account_id: params.id,
        name: snapshotName,
        created_by: user.id,
        created_by_name: displayName,
        page_count: pageCount,
        data: currentPages ?? [],
      })
      .select('id')
      .single()
    if (snapshotErr) return NextResponse.json({ error: `שגיאה ביצירת גיבוי: ${snapshotErr.message}` }, { status: 500 })

    // 3. Delete all pages for the account.
    //    If this fails the backup snapshot already exists — data is safe.
    const { error: deleteErr } = await adminSupa
      .from('pages')
      .delete()
      .eq('account_id', params.id)
    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

    // 4. Log the activity (best-effort; does not affect the deletion that already happened)
    await logActivity(supabase, {
      account_id: params.id,
      user_id: user.id,
      user_name: displayName,
      action: 'sitemap_cleared',
      details: { account_name, deleted_page_count: pageCount, backup_snapshot_id: backupSnapshot.id },
    })

    return NextResponse.json({ ok: true, deleted_page_count: pageCount, backup_snapshot_id: backupSnapshot.id })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
