import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { verifyAccountAccess } from '@/lib/utils/auth'
import { logActivity } from '@/lib/utils/activity'
import type { Page } from '@/types'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch snapshot
  const { data: snapshot } = await supabase
    .from('snapshots')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!snapshot) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const hasAccess = await verifyAccountAccess(supabase, user.id, snapshot.account_id)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  const displayName = profile?.display_name ?? user.id

  // Use service role for transactional work (bypass RLS for the atomic operation)
  const adminSupa = createServiceRoleClient()

  // 1. Create auto-backup snapshot of current state
  const { data: currentPages } = await adminSupa
    .from('pages')
    .select('*')
    .eq('account_id', snapshot.account_id)

  const backupName = `גיבוי לפני שחזור — ${snapshot.name} — ${new Date().toLocaleString('he-IL')}`

  const { data: backupSnapshot, error: backupErr } = await adminSupa.from('snapshots').insert({
    account_id: snapshot.account_id,
    name: backupName,
    created_by: user.id,
    created_by_name: displayName,
    page_count: currentPages?.length ?? 0,
    data: currentPages ?? [],
  }).select('id').single()

  if (backupErr) return NextResponse.json({ error: 'Failed to create backup: ' + backupErr.message }, { status: 500 })

  // 2. Delete all current pages
  const { error: deleteErr } = await adminSupa
    .from('pages')
    .delete()
    .eq('account_id', snapshot.account_id)

  if (deleteErr) {
    // Try to clean up the backup snapshot we just created
    await adminSupa.from('snapshots').delete().eq('id', backupSnapshot.id)
    return NextResponse.json({ error: 'Failed to clear pages: ' + deleteErr.message }, { status: 500 })
  }

  // 3. Re-insert pages from snapshot with new IDs (preserve structure and url_normalized)
  const snapshotPages: Page[] = snapshot.data ?? []
  if (snapshotPages.length > 0) {
    // Remap IDs: old_id → new_id, update parent_id references
    const idMap = new Map<string, string>()
    for (const p of snapshotPages) {
      idMap.set(p.id, crypto.randomUUID())
    }

    const newPages = snapshotPages.map(p => ({
      id: idMap.get(p.id)!,
      account_id: snapshot.account_id,
      parent_id: p.parent_id ? (idMap.get(p.parent_id) ?? null) : null,
      name: p.name,
      url: p.url,
      url_normalized: p.url_normalized,
      color: p.color,
      template: p.template,
      status: p.status,
      notes: p.notes,
      sort_order: p.sort_order,
      created_by: p.created_by,
      updated_by: user.id,
      created_at: p.created_at,
    }))

    const { error: insertErr } = await adminSupa.from('pages').insert(newPages)
    if (insertErr) {
      // Rollback: delete newly inserted pages (some may be there), restore backup would be complex —
      // instead, return error and the user can use the backup snapshot
      return NextResponse.json({
        error: 'Failed to restore pages: ' + insertErr.message,
        backup_snapshot_id: backupSnapshot.id,
      }, { status: 500 })
    }
  }

  // 4. Log activity
  await logActivity(supabase, {
    account_id: snapshot.account_id,
    user_id: user.id,
    user_name: displayName,
    action: 'snapshot_restored',
    entity_type: 'snapshot',
    entity_id: snapshot.id,
    entity_name: snapshot.name,
    details: { backup_snapshot_id: backupSnapshot.id, restored_page_count: snapshotPages.length },
  })

  return NextResponse.json({ ok: true, backup_snapshot_id: backupSnapshot.id })
}
