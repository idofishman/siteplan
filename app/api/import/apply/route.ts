import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyAccountAccess } from '@/lib/utils/auth'
import { logActivity } from '@/lib/utils/activity'
import type { ImportUrlPlan } from '@/lib/utils/importEngine'

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, urls }: { account_id: string; urls: ImportUrlPlan[] } = await request.json()
  if (!account_id || !urls?.length) return NextResponse.json({ error: 'account_id and urls required' }, { status: 400 })

  const hasAccess = await verifyAccountAccess(supabase, user.id, account_id)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  const displayName = profile?.display_name ?? user.id

  // Defensive dedup: even if the client sends duplicates, skip them here
  const seenNorm = new Set<string>()
  let toAdd = urls.filter(u => {
    if (u.action !== 'add') return false
    if (!u.url_normalized) return true // no-URL pages (name-only) are always allowed
    if (seenNorm.has(u.url_normalized)) return false
    seenNorm.add(u.url_normalized)
    return true
  })
  if (toAdd.length === 0) return NextResponse.json({ inserted: 0 })

  // Final DB check — remove any URLs that already exist (handles race conditions
  // and cases where the analyze step was run before some pages were added)
  const normalizedToCheck = toAdd.map(u => u.url_normalized).filter(Boolean) as string[]
  if (normalizedToCheck.length > 0) {
    const { data: alreadyInDb } = await supabase
      .from('pages')
      .select('url_normalized')
      .eq('account_id', account_id)
      .in('url_normalized', normalizedToCheck)
    if (alreadyInDb && alreadyInDb.length > 0) {
      const existingNorms = new Set(alreadyInDb.map(p => p.url_normalized))
      const before = toAdd.length
      toAdd = toAdd.filter(u => !u.url_normalized || !existingNorms.has(u.url_normalized))
      if (toAdd.length === 0) return NextResponse.json({ inserted: 0, skipped: before })
    }
  }

  const { data: existing } = await supabase
    .from('pages')
    .select('sort_order')
    .eq('account_id', account_id)
    .order('sort_order', { ascending: false })
    .limit(1)

  const baseSortOrder = (existing?.[0]?.sort_order ?? 0) + 1
  const isTree = toAdd.some(u => u.temp_id !== undefined)

  let newPages: Record<string, unknown>[]

  if (isTree) {
    // Pre-generate all UUIDs keyed by temp_id so parent_id can be resolved
    const idMap = new Map<string, string>()
    for (const u of toAdd) {
      if (u.temp_id) idMap.set(u.temp_id, crypto.randomUUID())
    }

    // Find homepage id: prefer one being imported in this batch, then fall back to DB
    let homepageDbId: string | null = null
    const homepageInBatch = toAdd.find(u => u.template === 'homepage' && !u.parent_temp_id)
    if (homepageInBatch?.temp_id) {
      homepageDbId = idMap.get(homepageInBatch.temp_id) ?? null
    } else {
      const { data: hp } = await supabase
        .from('pages').select('id')
        .eq('account_id', account_id).eq('template', 'homepage')
        .is('parent_id', null).limit(1).single()
      homepageDbId = hp?.id ?? null
    }

    newPages = toAdd.map((u, i) => {
      // Resolve parent_id from temp id map, or fall back to homepage for root-level non-homepage pages
      let parentId: string | null = null
      if (u.parent_temp_id) {
        parentId = idMap.get(u.parent_temp_id) ?? null
      } else if (u.template !== 'homepage' && homepageDbId) {
        parentId = homepageDbId
      }
      return ({
        id: u.temp_id ? idMap.get(u.temp_id) : undefined,
        account_id,
        parent_id: parentId,
      name: u.name?.trim() || deriveNameFromUrl(u.url),
        url: u.url || null,
        url_normalized: u.url_normalized || null,
        color: u.color ?? null,
        template: u.template ?? null,
        status: u.status ?? 'existing',
        sort_order: baseSortOrder + i,
        created_by: user.id,
        updated_by: user.id,
      })
    })
  } else {
    // For flat imports, find homepage and parent everything under it
    const { data: hp } = await supabase
      .from('pages').select('id')
      .eq('account_id', account_id).eq('template', 'homepage')
      .is('parent_id', null).limit(1).single()
    const flatHomepageId = hp?.id ?? null

    newPages = toAdd.map((u, i) => ({
      account_id,
      parent_id: flatHomepageId,
      name: u.name?.trim() || deriveNameFromUrl(u.url),
      url: u.url || null,
      url_normalized: u.url_normalized || null,
      status: 'existing',
      sort_order: baseSortOrder + i,
      created_by: user.id,
      updated_by: user.id,
    }))
  }

  const { error } = await supabase.from('pages').insert(newPages)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(supabase, {
    account_id,
    user_id: user.id,
    user_name: displayName,
    action: 'import_applied',
    details: { inserted: toAdd.length, skipped: urls.length - toAdd.length },
  })

  return NextResponse.json({ inserted: toAdd.length })
}

function deriveNameFromUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length === 0) return 'דף הבית'
    const last = parts[parts.length - 1]
    return last
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\.(html?|php|aspx?)$/i, '')
      .trim() || 'עמוד'
  } catch {
    return 'עמוד'
  }
}
