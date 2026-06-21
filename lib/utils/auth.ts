import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Verifies that a user has access to a given account.
 *
 * Access is granted if:
 *   1. The user has role = 'system_admin' (access to all accounts), OR
 *   2. The user has an explicit row in user_accounts for this account
 *
 * RLS is the definitive access boundary — this is defense-in-depth.
 * Even if this check has a bug, RLS at the DB level prevents unauthorized access.
 *
 * @param supabase - A server-side Supabase client using the user's session
 * @param userId - The authenticated user's ID
 * @param accountId - The account being accessed
 * @returns true if access is permitted, false otherwise
 */
export async function verifyAccountAccess(
  supabase: SupabaseClient,
  userId: string,
  accountId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile?.role === 'system_admin') return true

  const { data: assignment } = await supabase
    .from('user_accounts')
    .select('user_id')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .single()

  return !!assignment
}

/**
 * Checks whether the authenticated user is a system admin.
 * Returns the profile row if admin, null otherwise.
 *
 * Use this at the top of admin-only API routes before any other logic.
 *
 * @param supabase - A server-side Supabase client using the user's session
 * @param userId - The authenticated user's ID
 */
export async function requireSystemAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  return profile?.role === 'system_admin'
}

/** Allows both system_admin and admin roles. */
export async function requireAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  return profile?.role === 'system_admin' || profile?.role === 'admin'
}
