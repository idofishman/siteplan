// ─── Primitive types ────────────────────────────────────────────────────────

export type UserRole = 'system_admin' | 'admin' | 'user'

export type PageStatus =
  | 'planned'
  | 'existing'
  | 'in_progress'
  | 'needs_review'
  | 'approved'
  | 'deprecated'
  | 'redirect'
  | 'archived'

export type ImportMode =
  | 'analyze_only'
  | 'merge_into_existing'
  | 'create_new_sitemap'

export type ImportConflictBehavior = 'add_only' | 'overwrite_existing'

export type ImportJobStatus =
  | 'analyzing'
  | 'ready_for_review'
  | 'applied'
  | 'failed'
  | 'cancelled'

export type ConflictStatus =
  | 'new'
  | 'existing_overwrite'
  | 'existing_skip'
  | 'duplicate'
  | 'invalid'

export type BulkAction =
  | 'delete'
  | 'move'
  | 'change_status'
  | 'change_template'
  | 'change_color'
  | 'add_note'

// ─── Domain entities ─────────────────────────────────────────────────────────

export interface Account {
  id: string
  name: string
  slug: string
  domain: string | null
  is_active: boolean
  created_at: string
  created_by: string | null
}

export interface Profile {
  id: string
  display_name: string
  role: UserRole
  created_at: string
}

export interface UserAccount {
  user_id: string
  account_id: string
  assigned_at: string
}

export interface Page {
  id: string
  account_id: string
  parent_id: string | null
  name: string
  url: string | null
  url_normalized: string | null
  color: string | null
  template: string | null
  status: PageStatus
  notes: string | null
  sort_order: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  // Computed client-side from gsc_clicks map — not stored in DB
  gsc_clicks?: number
}

export interface PageNode extends Page {
  children: PageNode[]
}

export interface ActivityEntry {
  id: string
  account_id: string
  user_id: string | null
  user_name: string
  action: string
  entity_type: string | null
  entity_id: string | null
  entity_name: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface Snapshot {
  id: string
  account_id: string
  name: string
  created_by: string | null
  created_by_name: string
  created_at: string
  page_count: number
  data: Page[] // only populated in GET /api/snapshots/:id, not in list
}

export interface PresenceUser {
  user_id: string
  account_id: string
  display_name: string
  last_seen: string
  status: 'active' | 'inactive' // active < 2min, inactive 2-10min
}

export interface GscClick {
  id: string
  account_id: string
  url_original: string
  url_normalized: string
  clicks: number
  impressions: number | null
  ctr: number | null
  position: number | null
  uploaded_at: string
  period: string | null
}

// ─── Operation payloads ──────────────────────────────────────────────────────

export interface BulkOperationPayload {
  action: BulkAction
  page_ids: string[]
  value?: string
  append?: boolean // for add_note: append (true) vs replace (false)
}

// ─── Import types ─────────────────────────────────────────────────────────────

export interface ProposedPage {
  temp_id: string
  parent_temp_id: string | null
  matched_existing_page_id?: string | null
  conflict_status: ConflictStatus
  name: string
  url: string | null
  url_normalized: string | null
  template: string | null
  status: PageStatus
  color: string | null
  notes: string | null
  confidence: number // 0.0–1.0
  source_row?: number
  reasoning?: string
}

export interface ImportAnalysisResult {
  job_id: string
  summary: {
    new_count: number
    overwrite_count: number
    skip_count: number
    duplicate_count: number
    invalid_count: number
    suggested_hub_count: number
  }
  proposedPages: ProposedPage[]
  warnings: string[]
  assumptions: string[]
  duplicateUrls: string[]
  invalidRows: Array<{ row: number; reason: string }>
}

export interface ImportApplyPayload {
  account_id: string
  job_id: string
  approvedProposedPages: ProposedPage[]
  import_mode: ImportMode
  conflict_behavior: ImportConflictBehavior
}

export interface ImportApplyResult {
  created: number
  updated: number
  skipped: number
  invalid: number
  backup_snapshot_id: string
}
