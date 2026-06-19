import { normalizeUrl } from './url'

export interface ParsedUrl {
  url: string
  url_normalized: string
}

export interface ParseResult {
  type: 'xml_sitemap' | 'txt_urls' | 'csv'
  urls: ParsedUrl[]
  error?: string
}

export function parseSitemapContent(content: string, domain?: string): ParseResult {
  const trimmed = content.trim()

  // XML sitemap
  if (trimmed.startsWith('<') || trimmed.includes('<urlset') || trimmed.includes('<sitemapindex')) {
    return parseXmlSitemap(trimmed, domain)
  }

  // CSV (has commas, first line likely has headers)
  if (trimmed.includes(',') && trimmed.split('\n').length > 1) {
    return parseCsvUrls(trimmed, domain)
  }

  // Plain text — one URL per line
  return parseTxtUrls(trimmed, domain)
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
