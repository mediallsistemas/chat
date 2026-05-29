import { clsx } from 'clsx'

interface Crumb {
  label: string
  href?: string
}

export interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: Crumb[]
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, breadcrumbs, action, className }: PageHeaderProps) {
  return (
    <div className={clsx('flex items-center justify-between mb-6', className)}>
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 mb-1">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <i className="ti ti-chevron-right text-xs text-gx" aria-hidden="true" />}
                <span className={clsx('text-xs', i === breadcrumbs.length - 1 ? 'text-gray-500' : 'text-gx')}>
                  {crumb.label}
                </span>
              </span>
            ))}
          </nav>
        )}
        <h2 className="text-xl font-bold text-gray-900 font-sora">{title}</h2>
        {subtitle && <p className="text-sm text-gx mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
