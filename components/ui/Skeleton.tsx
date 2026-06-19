import type { CSSProperties } from 'react'

interface Props {
  className?: string
  style?: CSSProperties
}

export function Skeleton({ className = '', style }: Props) {
  return (
    <div className={`animate-pulse rounded bg-slate-200 ${className}`} style={style} />
  )
}

const WIDTHS = ['65%', '80%', '72%', '58%', '85%', '70%', '76%', '62%']

export function TreeSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3" style={{ paddingRight: `${(i % 3) * 20}px` }}>
          <Skeleton className="w-4 h-4 shrink-0" />
          <Skeleton className="w-3 h-3 rounded-full shrink-0" />
          <Skeleton className="h-4 flex-1" style={{ maxWidth: WIDTHS[i] }} />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-16 rounded-lg" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    </div>
  )
}
