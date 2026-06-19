import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'
import type { PageStatus } from '@/types'

interface Props {
  status: PageStatus
  size?: 'sm' | 'xs'
}

export function StatusBadge({ status, size = 'sm' }: Props) {
  const { bg, text } = STATUS_COLORS[status]
  const label = STATUS_LABELS[status]
  const cls = size === 'xs'
    ? 'px-1.5 py-0.5 text-xs'
    : 'px-2 py-0.5 text-xs'

  return (
    <span
      className={`inline-block rounded-full font-medium whitespace-nowrap ${cls}`}
      style={{ backgroundColor: bg, color: text }}
      aria-label={`סטטוס: ${label}`}
    >
      {label}
    </span>
  )
}
