import { normalizeUrl, cleanTrackingParams } from './url'
import { TEMPLATES } from '@/lib/constants'

const VALID_STATUSES = new Set([
  'planned', 'existing', 'in_progress', 'needs_review',
  'approved', 'deprecated', 'redirect', 'archived',
])
const VALID_TEMPLATES = new Set(TEMPLATES as readonly string[])

export interface ParsedUrl {
  url: string
  url_normalized: string
  // Present for tree-format JSON imports
  name?: string
  temp_id?: string
  parent_temp_id?: string | null
  color?: string | null
  template?: string | null
  status?: string
}

export interface ParseResult {
  type: 'xlsx' | 'csv' | 'json' | 'xml_sitemap' | 'txt_urls'
  urls: ParsedUrl[]
  error?: string
  cleanedCount: number
}

// Entry point for text-based formats (CSV, JSON, XML, TXT)
export function parseSitemapContent(content: string, domain?: string): ParseResult {
  const trimmed = content.trim()

  // JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return parseJsonUrls(trimmed, domain)
  }

  // XML sitemap
  if (trimmed.startsWith('<') || trimmed.includes('<urlset') || trimmed.includes('<sitemapindex')) {
    return parseXmlSitemap(trimmed, domain)
  }

  // CSV (has commas, multiple lines)
  if (trimmed.includes(',') && trimmed.split('\n').length > 1) {
    return parseCsvUrls(trimmed, domain)
  }

  // Plain text — one URL per line
  return parseTxtUrls(trimmed, domain)
}

// Entry point for XLSX (binary) — call with parsed rows from xlsx library
export function parseXlsxRows(
  rows: string[][],
  domain?: string
): ParseResult {
  if (rows.length === 0) return { type: 'xlsx', urls: [], cleanedCount: 0 }

  const header = rows[0].map(c => (c ?? '').toString().toLowerCase().trim())
  const urlColIndex = header.findIndex(h =>
    h === 'url' || h === 'address' || h === 'loc' || h === 'page' || h === 'כתובת'
  )

  const startRow = urlColIndex >= 0 ? 1 : 0
  const colIndex = urlColIndex >= 0 ? urlColIndex : 0

  const urls: ParsedUrl[] = []
  let cleanedCount = 0
  for (let i = startRow; i < rows.length; i++) {
    const raw = (rows[i][colIndex] ?? '').toString().trim()
    if (!raw) continue
    const { url: cleaned, wasCleaned } = cleanTrackingParams(raw)
    if (wasCleaned) cleanedCount++
    const norm = normalizeUrl(cleaned, domain)
    if (norm) urls.push({ url: cleaned, url_normalized: norm })
  }

  return { type: 'xlsx', urls, cleanedCount }
}

function parseJsonUrls(content: string, domain?: string): ParseResult {
  const urls: ParsedUrl[] = []
  let cleanedCount = 0
  try {
    const parsed = JSON.parse(content)

    // Detect tree format: array of objects with a "children" key
    const isTree = (val: unknown): boolean =>
      Array.isArray(val) &&
      val.length > 0 &&
      typeof val[0] === 'object' &&
      val[0] !== null &&
      'children' in (val[0] as object)

    if (isTree(parsed)) {
      for (const node of (parsed as Record<string, unknown>[])) {
        cleanedCount += flattenJsonTree(node, null, urls, domain)
      }
      return { type: 'json', urls, cleanedCount }
    }

    // Also handle single-root object with children
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'children' in parsed) {
      cleanedCount += flattenJsonTree(parsed as Record<string, unknown>, null, urls, domain)
      return { type: 'json', urls, cleanedCount }
    }

    // Flat format — array of strings or {url} objects
    const candidates: string[] = []
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === 'string') {
          candidates.push(item)
        } else if (item && typeof item === 'object') {
          const val = (item as Record<string, unknown>).url ??
                      (item as Record<string, unknown>).loc ??
                      (item as Record<string, unknown>).address ??
                      (item as Record<string, unknown>).href
          if (typeof val === 'string') candidates.push(val)
        }
      }
    } else if (parsed && typeof parsed === 'object') {
      const arr = (parsed as Record<string, unknown>).urls ??
                  (parsed as Record<string, unknown>).pages ??
                  (parsed as Record<string, unknown>).data
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (typeof item === 'string') candidates.push(item)
          else if (item && typeof item === 'object') {
            const val = (item as Record<string, unknown>).url ??
                        (item as Record<string, unknown>).loc ??
                        (item as Record<string, unknown>).address ??
                        (item as Record<string, unknown>).href
            if (typeof val === 'string') candidates.push(val)
          }
        }
      }
    }

    for (const raw of candidates) {
      const { url: cleaned, wasCleaned } = cleanTrackingParams(raw)
      if (wasCleaned) cleanedCount++
      const norm = normalizeUrl(cleaned, domain)
      if (norm) urls.push({ url: cleaned, url_normalized: norm })
    }
  } catch {
    return { type: 'json', urls: [], error: 'קובץ JSON לא תקין', cleanedCount: 0 }
  }

  return { type: 'json', urls, cleanedCount }
}

// Recursively walks a tree node; returns count of cleaned tracking-param URLs
function flattenJsonTree(
  node: Record<string, unknown>,
  parentTempId: string | null,
  result: ParsedUrl[],
  domain?: string
): number {
  let cleanedCount = 0
  const tempId = (node.id as string) || `tmp-${result.length}`
  const rawUrl = (node.url as string | undefined) ?? ''
  let urlToStore = rawUrl
  if (rawUrl) {
    const { url: cleaned, wasCleaned } = cleanTrackingParams(rawUrl)
    if (wasCleaned) { cleanedCount++; urlToStore = cleaned }
  }
  const norm = urlToStore ? (normalizeUrl(urlToStore, domain) ?? '') : ''

  const name = ((node.name as string) ?? '').trim()

  // Validate status — default to 'existing'
  const rawStatus = node.status as string | undefined
  const status = rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : 'existing'

  // Validate template — default to 'page'
  const rawTemplate = node.template as string | undefined
  const template = rawTemplate && VALID_TEMPLATES.has(rawTemplate) ? rawTemplate : 'page'

  const color = (node.color as string | undefined) ?? null

  // Always include the node (even if no URL) as long as it has a name
  if (name) {
    result.push({
      url: urlToStore,
      url_normalized: norm,
      name,
      temp_id: tempId,
      parent_temp_id: parentTempId,
      color,
      template,
      status,
    })
  }

  const children = node.children
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child && typeof child === 'object') {
        cleanedCount += flattenJsonTree(child as Record<string, unknown>, tempId, result, domain)
      }
    }
  }
  return cleanedCount
}

function parseXmlSitemap(content: string, domain?: string): ParseResult {
  const urlMatches = content.match(/<loc[^>]*>([^<]+)<\/loc>/g) ?? []
  const urls: ParsedUrl[] = []
  let cleanedCount = 0

  for (const match of urlMatches) {
    const raw = match.replace(/<loc[^>]*>/, '').replace(/<\/loc>/, '').trim()
    if (!raw) continue
    const { url: cleaned, wasCleaned } = cleanTrackingParams(raw)
    if (wasCleaned) cleanedCount++
    const norm = normalizeUrl(cleaned, domain)
    if (norm) urls.push({ url: cleaned, url_normalized: norm })
  }

  return { type: 'xml_sitemap', urls, cleanedCount }
}

function parseTxtUrls(content: string, domain?: string): ParseResult {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  const urls: ParsedUrl[] = []
  let cleanedCount = 0

  for (const line of lines) {
    const { url: cleaned, wasCleaned } = cleanTrackingParams(line)
    if (wasCleaned) cleanedCount++
    const norm = normalizeUrl(cleaned, domain)
    if (norm) urls.push({ url: cleaned, url_normalized: norm })
  }

  return { type: 'txt_urls', urls, cleanedCount }
}

function parseCsvUrls(content: string, domain?: string): ParseResult {
  const lines = content.split('\n').filter(l => l.trim())
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const urlColIndex = headers.findIndex(h => h === 'url' || h === 'address' || h === 'loc' || h === 'page')

  const urls: ParsedUrl[] = []
  let cleanedCount = 0
  const startIndex = urlColIndex >= 0 ? 1 : 0
  const colIndex = urlColIndex >= 0 ? urlColIndex : 0

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(',')
    const raw = (parts[colIndex] ?? '').trim().replace(/"/g, '')
    if (!raw) continue
    const { url: cleaned, wasCleaned } = cleanTrackingParams(raw)
    if (wasCleaned) cleanedCount++
    const norm = normalizeUrl(cleaned, domain)
    if (norm) urls.push({ url: cleaned, url_normalized: norm })
  }

  return { type: 'csv', urls, cleanedCount }
}
