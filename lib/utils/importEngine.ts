import type { Page } from '@/types'
import type { ParsedUrl } from './importParser'

export type ImportAction = 'add' | 'skip'

export interface ImportUrlPlan {
  url: string
  url_normalized: string
  action: ImportAction
  existingPage?: Pick<Page, 'id' | 'name'>
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

  const seen = new Set<string>()
  const toAdd: ImportUrlPlan[] = []
  const toSkip: ImportUrlPlan[] = []

  for (const { url, url_normalized } of parsed) {
    if (seen.has(url_normalized)) continue
    seen.add(url_normalized)

    const existing = existingMap.get(url_normalized)
    const plan: ImportUrlPlan = { url, url_normalized, action: existing ? 'skip' : 'add', existingPage: existing }

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
