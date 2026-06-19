import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyAccountAccess } from '@/lib/utils/auth'
import { logActivity } from '@/lib/utils/activity'
import { getDescendantIds } from '@/lib/utils/tree'
import { buildTree } from '@/lib/utils/tree'
import type { BulkOperationPayload, Page, PageStatus } from '@/types'

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: BulkOperationPayload & { account_id: string } = await request.json()
  const { action, page_ids, value, append, account_id } = body

  if (!account_id) return NextResponse.json({ error: 'account_id required' }, { status: 400 })

  const hasAccess = await verifyAccountAccess(supabase, user.id, account_id)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  const userName = profile?.display_name ?? user.id

  if (action === 'delete') {
    // Expand to include all descendants
    const { data: allPages } = await supabase.from('pages').select('*').eq('account_id', account_id)
    const tree = buildTree((allPages ?? []) as Page[])
    const toDelete = new Set(page_ids)
    for (const id of page_ids) {
      for (const desc of getDescendantIds(tree, id)) toDelete.add(desc)
    }

    const { error } = await supabase.from('pages').delete().in('id', [...toDelete])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logActivity(supabase, {
      account_id,
      user_id: user.id,
      user_name: userName,
      action: 'bulk_delete',
      details: { page_ids: page_ids, affected_total: toDelete.size },
    })

    return NextResponse.json({ updated_count: toDelete.size, pages: [] })
  }

  // Build update payload
  let updateData: Partial<Page> = {}

  if (action === 'change_status') {
    if (!value) return NextResponse.json({ error: 'value required for change_status' }, { status: 400 })
    updateData = { status: value as PageStatus }
  } else if (action === 'change_template') {
    updateData = { template: value ?? null }
  } else if (action === 'change_color') {
    updateData = { color: value ?? null }
  } else if (action === 'add_note') {
    // Handle per-page for append mode
    if (append) {
      const { data: pages } = await supabase.from('pages').select('id, notes').in('id', page_ids)
      for (const page of pages ?? []) {
        const combined = [page.notes, value].filter(Boolean).join('\n')
        await supabase.from('pages').update({ notes: combined, updated_by: user.id }).eq('id', page.id)
      }
    } else {
      updateData = { notes: value ?? null }
    }
  } else if (action === 'move') {
    updateData = { parent_id: value ?? null }
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  let pages: Page[] = []

  if (action !== 'add_note' || !append) {
    const { data, error } = await supabase
      .from('pages')
      .update({ ...updateData, updated_by: user.id })
      .in('id', page_ids)
      .select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    pages = data as Page[]
  } else {
    const { data } = await supabase.from('pages').select('*').in('id', page_ids)
    pages = (data as Page[]) ?? []
  }

  await logActivity(supabase, {
    account_id,
    user_id: user.id,
    user_name: userName,
    action: `bulk_${action}`,
    details: { page_ids, count: page_ids.length, value },
  })

  return NextResponse.json({ updated_count: pages.length, pages })
}
