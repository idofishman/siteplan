import { normalizeUrl } from './url'

export interface ParsedUrl {
  url: string
  url_normalized: string
}

export interface ParseResult {
  type: 'xlsx' | 'csv' | 'json' | 'xml_sitemap' | 'txt_urls'
  urls: ParsedUrl[]
  error?: string
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
  if (rows.length === 0) return { type: 'xlsx', urls: [] }

  // Find the URL column: look at header row first
  const header = rows[0].map(c => (c ?? '').toString().toLowerCase().trim())
  const urlColIndex = header.findIndex(h =>
    h === 'url' || h === 'address' || h === 'loc' || h === 'page' || h === 'כתובת'
  )

  const startRow = urlColIndex >= 0 ? 1 : 0
  const colIndex = urlColIndex >= 0 ? urlColIndex : 0

  const urls: ParsedUrl[] = []
  for (let i = startRow; i < rows.length; i++) {
    const raw = (rows[i][colIndex] ?? '').toString().trim()
    if (!raw) continue
    const norm = normalizeUrl(raw, domain)
    if (norm) urls.push({ url: raw, url_normalized: norm })
  }

  return { type: 'xlsx', urls }
}

function parseJsonUrls(content: string, domain?: string): ParseResult {
  const urls: ParsedUrl[] = []
  try {
    const parsed = JSON.parse(content)

    const candidates: string[] = []

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === 'string') {
          candidates.push(item)
        } else if (item && typeof item === 'object') {
          // Support {url, loc, address, href} keys
          const val = item.url ?? item.loc ?? item.address ?? item.href
          if (typeof val === 'string') candidates.push(val)
        }
      }
    } else if (parsed && typeof parsed === 'object') {
      // Support {urls: [...]} wrapper
      const arr = parsed.urls ?? parsed.pages ?? parsed.data
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (typeof item === 'string') candidates.push(item)
          else if (item && typeof item === 'object') {
            const val = item.url ?? item.loc ?? item.address ?? item.href
            if (typeof val === 'string') candidates.push(val)
          }
        }
      }
    }

    for (const raw of candidates) {
      const norm = normalizeUrl(raw, domain)
      if (norm) urls.push({ url: raw, url_normalized: norm })
    }
  } catch {
    return { type: 'json', urls: [], error: 'קובץ JSON לא תקין' }
  }

  return { type: 'json', urls }
}

function parseXmlSitemap(content: string, domain?: string): ParseResult {
  const urlMatches = content.match(/<loc[^>]*>([^<]+)<\/loc>/g) ?? []
  const urls: ParsedUrl[] = []

  for (const match of urlMatches) {
    const raw = match.replace(/<loc[^>]*>/, '').replace(/<\/loc>/, '').trim()
    if (!raw) continue
    const norm = normalizeUrl(raw, domain)
    if (norm) urls.push({ url: raw, url_normalized: norm })
  }

  return { type: 'xml_sitemap', urls }
}

function parseTxtUrls(content: string, domain?: string): ParseResult {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  const urls: ParsedUrl[] = []

  for (const line of lines) {
    const norm = normalizeUrl(line, domain)
    if (norm) urls.push({ url: line, url_normalized: norm })
  }

  return { type: 'txt_urls', urls }
}

function parseCsvUrls(content: string, domain?: string): ParseResult {
  const lines = content.split('\n').filter(l => l.trim())
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const urlColIndex = headers.findIndex(h => h === 'url' || h === 'address' || h === 'loc' || h === 'page')

  const urls: ParsedUrl[] = []
  const startIndex = urlColIndex >= 0 ? 1 : 0
  const colIndex = urlColIndex >= 0 ? urlColIndex : 0

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(',')
    const raw = (parts[colIndex] ?? '').trim().replace(/"/g, '')
    if (!raw) continue
    const norm = normalizeUrl(raw, domain)
    if (norm) urls.push({ url: raw, url_normalized: norm })
  }

  return { type: 'csv', urls }
}
