import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/utils/auth'

// ---------------------------------------------------------------------------
// Colman-specific URL → slug mapping
// Based on "מבנה URL מכללה למנהל - אתר חדש" document.
// Each rule is checked in order; first match wins.
// ---------------------------------------------------------------------------

interface SlugRule {
  // Returns a slug string if the rule matches, null to skip to next rule
  match: (segments: string[], path: string) => string | null
}

// Direct segment-to-slug remaps (last segment of old URL → new slug)
const SEGMENT_MAP: Record<string, string> = {
  // Degree lobbies — old site uses 'ba'/'ma', new site uses full words
  'ba':        'bachelors',
  'ma':        'masters',
  'phd':       'phd',
  // Campus / admin sections
  'news':              'news-and-events',
  'news-and-events':   'news-and-events',
  'events':            'news-and-events',
  'lecturers':         'lecturers',
  'faculty':           'lecturers',
  'library':           'library',
  'dorms':             'dorms',
  'dormitories':       'dorms',
  'shop':              'shop',
  // Registration section
  'registration':                  'registration-and-information',
  'registration-and-information':  'registration-and-information',
  'open-days':                     'open-days',
  'open-day':                      'open-days',
  'scholarships':                  'scholarships',
  'evening-study':                 'evening-study',
  'evening':                       'evening-study',
  'campus-bnei-brak':              'campus-bnei-brak',
  'bnei-brak':                     'campus-bnei-brak',
  'campus-dimona':                 'campus-dimona',
  'dimona':                        'campus-dimona',
  'preperation-programs':          'preperation-programs',
  'preparation-programs':          'preperation-programs',
  'mechina':                       'preperation-programs',
  // Research
  'research-centers':  'research-centers',
  'research-center':   'research-centers',
  'research-authority': 'research-authority',
  // Campus life
  'campus-and-community': 'campus-and-community',
  'campus':               'campus-and-community',
}

// Law faculty — degree pages need academic codes, not generic 'ba'/'ma'
// Detects: URL contains /law/ (any position) AND last segment is a degree indicator
const LAW_DEGREE_INDICATORS: Record<string, string> = {
  'ba': 'llb', 'bachelor': 'llb', 'bachelors': 'llb', 'llb': 'llb',
  'ma': 'llm', 'master': 'llm',  'masters': 'llm',   'llm': 'llm',
}

// Faculty-name → slug (old URL uses descriptive names, new uses short codes)
// Extend this list for each faculty as their slugs become known
const FACULTY_SLUG_MAP: Record<string, string> = {
  'law':                       'law',
  'law-school':                'law',
  'faculty-of-law':            'law',
  'mishpatim':                 'law',
  'business-administration':   'business-administration',
  'accounting':                'accounting',
  'economics':                 'economics',
  'psychology':                'psychology',
  'communication':             'communication',
  'criminology':               'criminology',
  'political-science':         'political-science',
  'education':                 'education',
  'industrial-engineering':    'industrial-engineering',
  'information-systems':       'information-systems',
  'computer-science':          'computer-science',
  'data-science':              'data-science',
}

const COLMAN_RULES: SlugRule[] = [
  // Rule 1: URL contains /law/ (faculty context) + last segment is degree indicator
  {
    match: (segments, path) => {
      if (!path.includes('/law/') && !path.includes('/law-school/') && !path.includes('/mishpatim/')) return null
      const last = segments[segments.length - 1]
      return LAW_DEGREE_INDICATORS[last] ?? null
    },
  },
  // Rule 2: Faculty-level pages — last segment maps to a known faculty slug
  {
    match: (segments) => {
      const last = segments[segments.length - 1]
      return FACULTY_SLUG_MAP[last] ?? null
    },
  },
  // Rule 3: Generic segment remaps
  {
    match: (segments) => {
      const last = segments[segments.length - 1]
      return SEGMENT_MAP[last] ?? null
    },
  },
]

function generateSlug(url: string | null): string | null {
  if (!url) return null
  try {
    const path = url.startsWith('http') ? new URL(url).pathname : url
    const segments = path.split('/').filter(Boolean)
    if (!segments.length) return null

    // Run Colman rules first
    for (const rule of COLMAN_RULES) {
      const slug = rule.match(segments, path)
      if (slug) return slug
    }

    // Fallback: sanitise the last segment
    const last = segments[segments.length - 1]
    return last.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || null
  } catch {
    return null
  }
}

// POST: create snapshot backup, then populate new_url slugs for all pages missing them
export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = await requireAdmin(supabase, user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { account_id, overwrite = false } = await request.json()
  if (!account_id) return NextResponse.json({ error: 'account_id required' }, { status: 400 })

  const adminSupa = createServiceRoleClient()

  // 1. Create backup snapshot
  const { data: allPagesForSnapshot } = await adminSupa
    .from('pages')
    .select('*')
    .eq('account_id', account_id)
    .eq('is_deleted', false)

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  const { error: snapError } = await adminSupa.from('snapshots').insert({
    account_id,
    name: `לפני יצירת slugs אוטומטית — ${new Date().toLocaleString('he-IL')}`,
    created_by: user.id,
    created_by_name: profile?.display_name ?? 'מערכת',
    page_count: allPagesForSnapshot?.length ?? 0,
    data: allPagesForSnapshot ?? [],
  })

  if (snapError) return NextResponse.json({ error: `Snapshot failed: ${snapError.message}` }, { status: 500 })

  // 2. Fetch pages to update
  const { data: pages, error: pagesError } = await adminSupa
    .from('pages')
    .select('id, url, new_url')
    .eq('account_id', account_id)
    .eq('is_deleted', false)

  if (pagesError) return NextResponse.json({ error: pagesError.message }, { status: 500 })

  const toUpdate = (pages ?? []).filter(p => overwrite ? true : !p.new_url)

  let updated = 0
  let skipped = 0

  for (const p of toUpdate) {
    const slug = generateSlug(p.url)
    if (!slug) { skipped++; continue }

    const { error } = await adminSupa
      .from('pages')
      .update({ new_url: slug })
      .eq('id', p.id)

    if (!error) updated++
    else skipped++
  }

  return NextResponse.json({
    ok: true,
    snapshot_created: true,
    updated,
    skipped,
    total: toUpdate.length,
  })
}

// GET: preview what slugs would be generated (dry run, no changes)
export async function GET(request: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = await requireAdmin(supabase, user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('account_id')
  if (!accountId) return NextResponse.json({ error: 'account_id required' }, { status: 400 })

  const { data: pages } = await supabase
    .from('pages')
    .select('id, name, url, new_url')
    .eq('account_id', accountId)
    .eq('is_deleted', false)

  const preview = (pages ?? []).map(p => ({
    id: p.id,
    name: p.name,
    current_url: p.url,
    existing_slug: p.new_url,
    generated_slug: generateSlug(p.url),
    would_update: !p.new_url,
  }))

  return NextResponse.json({ preview, total: preview.length, to_update: preview.filter(p => p.would_update).length })
}
