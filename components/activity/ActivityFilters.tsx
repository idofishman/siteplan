'use client'

interface Filters {
  userId: string
  action: string
  from: string
  to: string
}

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
}

const ACTIONS = [
  'page_created', 'page_edited', 'page_deleted', 'page_moved',
  'bulk_delete', 'bulk_change_status', 'bulk_change_template', 'bulk_change_color', 'bulk_add_note', 'bulk_move',
  'snapshot_created', 'snapshot_restored',
  'gsc_uploaded', 'import_applied', 'sitemap_cleared',
]

const ACTION_LABELS: Record<string, string> = {
  page_created: 'יצירת עמוד',
  page_edited: 'עריכת עמוד',
  page_deleted: 'מחיקת עמוד',
  page_moved: 'העברת עמוד',
  bulk_delete: 'מחיקה מרובה',
  bulk_change_status: 'שינוי סטטוס',
  bulk_change_template: 'שינוי תבנית',
  bulk_change_color: 'שינוי צבע',
  bulk_add_note: 'הוספת הערה',
  bulk_move: 'העברה מרובה',
  snapshot_created: 'יצירת גיבוי',
  snapshot_restored: 'שחזור גיבוי',
  gsc_uploaded: 'העלאת GSC',
  import_applied: 'ייבוא מפה',
  sitemap_cleared: 'ניקוי מפה',
}

export function ActivityFilters({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3 p-4 bg-slate-50 border-b border-slate-200">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">פעולה</label>
        <select
          value={filters.action}
          onChange={e => onChange({ ...filters, action: e.target.value })}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">הכל</option>
          {ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">מתאריך</label>
        <input
          type="date"
          value={filters.from}
          onChange={e => onChange({ ...filters, from: e.target.value })}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          dir="ltr"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">עד תאריך</label>
        <input
          type="date"
          value={filters.to}
          onChange={e => onChange({ ...filters, to: e.target.value })}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          dir="ltr"
        />
      </div>

      <div className="flex items-end">
        <button
          onClick={() => onChange({ userId: '', action: '', from: '', to: '' })}
          className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5"
        >
          נקה סינון
        </button>
      </div>
    </div>
  )
}
