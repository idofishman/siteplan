interface Props {
  name: string
  size?: 'sm' | 'md'
  isActive?: boolean
}

export function Avatar({ name, size = 'sm', isActive }: Props) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'

  return (
    <div className="relative shrink-0">
      <div className={`${dim} rounded-full bg-slate-600 text-white font-medium flex items-center justify-center`}>
        {initials}
      </div>
      {isActive !== undefined && (
        <span
          className={`absolute bottom-0 end-0 w-2 h-2 rounded-full border border-white ${isActive ? 'bg-green-500' : 'bg-amber-400'}`}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
