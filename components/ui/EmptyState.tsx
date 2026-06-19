interface Props {
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <p className="text-lg font-medium text-slate-600">{title}</p>
      {description && <p className="text-sm text-slate-400">{description}</p>}
      {action}
    </div>
  )
}
