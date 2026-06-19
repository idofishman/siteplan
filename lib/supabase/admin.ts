import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client using the service role key.
 *
 * WARNING: This client BYPASSES Row Level Security.
 * Use ONLY for the following server-side operations:
 *   - System admin operations: creating/archiving accounts, managing user roles
 *   - Supabase Auth admin API calls (e.g., listing all users via auth.admin)
 *   - Trusted server-only maintenance (e.g., presence cleanup cron)
 *   - Operations that structurally cannot work with user-scoped RLS
 *
 * Never import this in client-side code. Never expose the service role key to the browser.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
