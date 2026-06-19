'use client'

interface Props {
  status: 'idle' | 'saving' | 'saved' | 'error'
}

export function SaveIndicator({ status }: Props) {
  if (status === 'idle') return null

  return (
    <span className={`text-xs font-medium transition-all ${
      status === 'saving' ? 'text-slate-400' :
      status === 'saved'  ? 'text-green-600' :
                            'text-red-500'
    }`}>
      {status === 'saving' && 'שומר...'}
      {status === 'saved'  && 'נשמר ✓'}
      {status === 'error'  && 'שגיאת שמירה ✗'}
    </span>
  )
}
