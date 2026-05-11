import { Button } from './button'

interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-20 text-gs">
      <i className={`ti ${icon} text-4xl block mb-3 opacity-30`} aria-hidden="true" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs mt-1">{description}</p>}
      {action && (
        <Button className="mt-4" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
