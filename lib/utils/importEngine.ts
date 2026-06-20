import type { Page } from '@/types'
import type { ParsedUrl } from './importParser'

export type ImportAction = 'add' | 'skip'

export interface ImportUrlPlan {
  url: string
  url_normalized: string
  action: ImportAction
  existingPage?: Pick<Page, 'id' | 'name'>
  // Present for tree-format JSON imports
  name?: string
  temp_id?: string
  parent_temp_id?: string | null
  color?: string | null
  template?: string | null
  status?: string
}

export interface ImportPlan {
  toAdd: ImportUrlPlan[]
  toSkip: ImportUrlPlan[]
  totalUrls: number
  newCount: number
  existingCount: number
}

export function buildImportPlan(
  parsed: ParsedUrl[],
  existingPages: Pick<Page, 'id' | 'name' | 'url_normalized'>[]
): ImportPlan {
  const existingMap = new Map(
    existingPages
      .filter(p => p.url_normalized)
      .map(p => [p.url_normalized!, p])
  )

  // For tree imports (with temp_id), deduplicate by temp_id.
  // For flat imports, deduplicate by url_normalized.
  const isTree = parsed.length > 0 && parsed[0].temp_id !== undefined
  const seen = new Set<string>()
  const toAdd: ImportUrlPlan[] = []
  const toSkip: ImportUrlPlan[] = []

  for (const p of parsed) {
    const { url, url_normalized } = p

    // Deduplication key
    const key = isTree ? (p.temp_id ?? url_normalized) : url_normalized
    if (key && seen.has(key)) continue
    if (key) seen.add(key)

    // For tree imports, a page with no URL is always "add" (can't be a duplicate)
    const existing = url_normalized ? existingMap.get(url_normalized) : undefined

    const plan: ImportUrlPlan = {
      url,
      url_normalized,
      action: existing ? 'skip' : 'add',
      existingPage: existing,
      name: p.name,
      temp_id: p.temp_id,
      parent_temp_id: p.parent_temp_id,
      color: p.color,
      template: p.template,
      status: p.status,
    }

    if (existing) {
      toSkip.push(plan)
    } else {
      toAdd.push(plan)
    }
  }

  return {
    toAdd,
    toSkip,
    totalUrls: toAdd.length + toSkip.length,
    newCount: toAdd.length,
    existingCount: toSkip.length,
  }
}
