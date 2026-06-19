/**
 * Normalize a URL for consistent comparison across all subsystems:
 * sitemap CRUD, GSC upload, intelligent import engine, and missing URLs matching.
 *
 * Always use this function — never implement ad-hoc URL comparison.
 *
 * @param rawUrl - Raw URL from any source
 * @param accountDomain - Account domain for converting absolute to relative (e.g., 'colman.ac.il')
 * @returns Normalized relative URL string, or null if invalid/empty
 */
export function normalizeUrl(
  rawUrl: string | null | undefined,
  accountDomain?: string
): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null

  let url = rawUrl.trim().toLowerCase()

  if (!url) return null

  // Convert absolute URL to relative if domain matches account domain
  if (accountDomain) {
    const domain = accountDomain.toLowerCase()
    const prefixes = [
      `https://${domain}`,
      `http://${domain}`,
      `https://www.${domain}`,
      `http://www.${domain}`,
    ]
    for (const prefix of prefixes) {
      if (url.startsWith(prefix)) {
        url = url.slice(prefix.length) || '/'
        break
      }
    }
  }

  // Remove query string and hash
  url = url.split('?')[0].split('#')[0]

  // Ensure starts with /
  if (!url.startsWith('/')) {
    url = '/' + url
  }

  // Remove trailing slash (except root /)
  if (url.length > 1 && url.endsWith('/')) {
    url = url.slice(0, -1)
  }

  // Basic validity check: must contain only path-safe characters
  if (!/^\/[a-z0-9\-._~:@!$&'()*+,;=%/]*$/.test(url) && url !== '/') {
    return null
  }

  return url
}
