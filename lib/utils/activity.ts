import type { SupabaseClient } from '@supabase/supabase-js'

interface ActivityData {
  account_id: string
  user_id: string
  user_name: string
  action: string
  entity_type?: string | null
  entity_id?: string | null
  entity_name?: string | null
  details?: Record<string, unknown> | null
}

export async function logActivity(supabase: SupabaseClient, data: ActivityData) {
  await supabase.from('activity_log').insert({
    account_id: data.account_id,
    user_id: data.user_id,
    user_name: data.user_name,
    action: data.action,
    entity_type: data.entity_type ?? null,
    entity_id: data.entity_id ?? null,
    entity_name: data.entity_name ?? null,
    details: data.details ?? null,
  })
}
