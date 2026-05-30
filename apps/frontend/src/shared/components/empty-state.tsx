interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon = 'ti-mood-empty', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-page-bg flex items-center justify-center mb-4">
        <i className={`ti ${icon} text-3xl text-gx`} aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-gray-700 font-sora mb-1">{title}</h3>
      {description && <p className="text-sm text-gx max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
