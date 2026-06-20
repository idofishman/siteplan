import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyAccountAccess } from '@/lib/utils/auth'
import { normalizeUrl } from '@/lib/utils/url'
import { logActivity } from '@/lib/utils/activity'
import type { Page } from '@/types'

async function getPageAndVerify(supabase: ReturnType<typeof createServerClient>, pageId: string, userId: string) {
  const { data: page } = await supabase
    .from('pages')
    .select('*')
    .eq('id', pageId)
    .single()

  if (!page) return { page: null, allowed: false }

  const allowed = await verifyAccountAccess(supabase, userId, page.account_id)
  return { page: page as Page, allowed }
}

async function getDisplayName(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single()
  return profile?.display_name ?? userId
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { page, allowed } = await getPageAndVerify(supabase, params.id, user.id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const prev = { ...page }

  // If URL changed, recompute url_normalized
  let url_normalized = page.url_normalized
  if ('url' in body) {
    const { data: account } = await supabase
      .from('accounts')
      .select('domain')
      .eq('id', page.account_id)
      .single()
    url_normalized = body.url ? normalizeUrl(body.url, account?.domain ?? undefined) : null
  }

  const { data: updated, error } = await supabase
    .from('pages')
    .update({ ...body, url_normalized, updated_by: user.id })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userName = await getDisplayName(supabase, user.id)
  const isMove = 'parent_id' in body || 'sort_order' in body

  await logActivity(supabase, {
    account_id: page.account_id,
    user_id: user.id,
    user_name: userName,
    action: isMove ? 'page_moved' : 'page_edited',
    entity_type: 'page',
    entity_id: page.id,
    entity_name: updated.name,
    details: isMove
      ? { from_parent: prev.parent_id, to_parent: updated.parent_id }
      : { prev: { name: prev.name, status: prev.status, url: prev.url }, next: { name: updated.name, status: updated.status, url: updated.url } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { page, allowed } = await getPageAndVerify(supabase, params.id, user.id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Parse optional body for reassign_to / cascade
  let reassignTo: string | null = null
  let cascade = false
  try {
    const body = await request.json()
    reassignTo = body.reassign_to ?? null
    cascade = !!body.cascade
  } catch {
    // No body or non-JSON body — proceed with simple delete
  }

  if (cascade) {
    // Recursively find all descendant page ids and delete them all
    const { data: allPages } = await supabase
      .from('pages')
      .select('id, parent_id')
      .eq('account_id', page.account_id)
    const childrenMap = new Map<string, string[]>()
    for (const p of allPages ?? []) {
      if (p.parent_id) {
        if (!childrenMap.has(p.parent_id)) childrenMap.set(p.parent_id, [])
        childrenMap.get(p.parent_id)!.push(p.id)
      }
    }
    const toDelete: string[] = []
    const collect = (id: string) => {
      toDelete.push(id)
      for (const child of childrenMap.get(id) ?? []) collect(child)
    }
    collect(params.id)
    const { error } = await supabase.from('pages').delete().in('id', toDelete)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const userName = await getDisplayName(supabase, user.id)
    await logActivity(supabase, {
      account_id: page.account_id, user_id: user.id, user_name: userName,
      action: 'page_deleted', entity_type: 'page', entity_id: page.id, entity_name: page.name,
      details: { cascade: true, deleted_count: toDelete.length },
    })
    return NextResponse.json({ deleted_count: toDelete.length })
  }

  if (reassignTo) {
    // Re-parent direct children to reassignTo before deleting
    const { error: reparentErr } = await supabase
      .from('pages')
      .update({ parent_id: reassignTo })
      .eq('parent_id', params.id)
    if (reparentErr) return NextResponse.json({ error: reparentErr.message }, { status: 500 })
  }

  const { error } = await supabase.from('pages').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userName = await getDisplayName(supabase, user.id)
  await logActivity(supabase, {
    account_id: page.account_id, user_id: user.id, user_name: userName,
    action: 'page_deleted', entity_type: 'page', entity_id: page.id, entity_name: page.name,
    details: reassignTo ? { reassigned_children_to: reassignTo } : undefined,
  })

  return NextResponse.json({ deleted_count: 1 })
}
