import type { Page } from '@/types'
import type { ParsedUrl } from './importParser'

export type ImportAction = 'add' | 'skip' | 'duplicate'

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
  duplicates: ImportUrlPlan[]
  totalUrls: number
  newCount: number
  existingCount: number
  duplicateCount: number
  cleanedCount: number
}

export function buildImportPlan(
  parsed: ParsedUrl[],
  existingPages: Pick<Page, 'id' | 'name' | 'url_normalized'>[],
  cleanedCount = 0
): ImportPlan {
  const existingMap = new Map(
    existingPages
      .filter(p => p.url_normalized)
      .map(p => [p.url_normalized!, p])
  )

  const isTree = parsed.length > 0 && parsed[0].temp_id !== undefined

  // Tracks temp_ids already processed (prevents processing the same node twice)
  const seenTempIds = new Set<string>()
  // Tracks url_normalized already seen in this file (prevents file-internal duplicates)
  // Maps url_normalized → canonical temp_id of the first-seen node with that URL
  const fileUrlToCanonicalTempId = new Map<string, string>()
  // Maps duplicate temp_id → canonical temp_id so children can be re-parented
  const dupRemap = new Map<string, string>()

  const toAdd: ImportUrlPlan[] = []
  const toSkip: ImportUrlPlan[] = []
  const duplicates: ImportUrlPlan[] = []

  for (const p of parsed) {
    // Deduplicate by temp_id (same node appearing twice in data)
    if (isTree && p.temp_id) {
      if (seenTempIds.has(p.temp_id)) continue
      seenTempIds.add(p.temp_id)
    }

    // Re-parent: if this node's parent was a duplicate, point to the canonical parent instead
    let parentTempId = p.parent_temp_id ?? null
    if (parentTempId && dupRemap.has(parentTempId)) {
      parentTempId = dupRemap.get(parentTempId)!
    }

    const norm = p.url_normalized

    // File-internal duplicate check (only for nodes with a non-empty url_normalized)
    if (norm) {
      if (fileUrlToCanonicalTempId.has(norm)) {
        // This URL already appeared in the file — mark as duplicate and remap children
        const canonicalTempId = fileUrlToCanonicalTempId.get(norm)!
        if (p.temp_id) dupRemap.set(p.temp_id, canonicalTempId)
        duplicates.push({
          url: p.url,
          url_normalized: norm,
          action: 'duplicate',
          name: p.name,
          temp_id: p.temp_id,
          parent_temp_id: parentTempId,
          color: p.color,
          template: p.template,
          status: p.status,
        })
        continue
      }
      // Record this URL as canonical for this file
      fileUrlToCanonicalTempId.set(norm, p.temp_id ?? norm)
    }

    // Pages with no url_normalized are allowed only when they have a name
    if (!norm && !p.name?.trim()) continue

    // Check against existing DB pages
    const existing = norm ? existingMap.get(norm) : undefined

    const plan: ImportUrlPlan = {
      url: p.url,
      url_normalized: norm,
      action: existing ? 'skip' : 'add',
      existingPage: existing,
      name: p.name,
      temp_id: p.temp_id,
      parent_temp_id: parentTempId,
      color: p.color,
      template: p.template,
      status: p.status,
    }

    if (existing) {
      // Also record the canonical temp_id for skipped pages so their children
      // are parented to the existing DB page's canonical slot
      if (norm && p.temp_id && !fileUrlToCanonicalTempId.has(norm)) {
        fileUrlToCanonicalTempId.set(norm, p.temp_id)
      }
      toSkip.push(plan)
    } else {
      toAdd.push(plan)
    }
  }

  return {
    toAdd,
    toSkip,
    duplicates,
    totalUrls: toAdd.length + toSkip.length + duplicates.length,
    newCount: toAdd.length,
    existingCount: toSkip.length,
    duplicateCount: duplicates.length,
    cleanedCount,
  }
}
