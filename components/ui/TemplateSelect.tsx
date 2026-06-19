import { TEMPLATES } from '@/lib/constants'

interface Props {
  value: string | null
  onChange: (value: string | null) => void
}

export function TemplateSelect({ value, onChange }: Props) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
    >
      <option value="">בחר תבנית...</option>
      {TEMPLATES.map(t => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  )
}
