import { clsx } from 'clsx'
import { UserRole, AccessScope } from '@mediall/types'

type BadgeVariant = 'role' | 'scope' | 'status' | 'priority' | 'default'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  value?: UserRole | AccessScope | string
  className?: string
}

const ROLE_STYLES: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'bg-purple-100 text-purple-700',
  [UserRole.DIRETORIA]: 'bg-blue-100 text-blue-700',
  [UserRole.GESTOR]: 'bg-gn/20 text-gd',
  [UserRole.COLABORADOR]: 'bg-gray-100 text-gray-600',
  [UserRole.VISUALIZADOR]: 'bg-gray-50 text-gray-400',
}

const SCOPE_STYLES: Record<AccessScope, string> = {
  [AccessScope.GLOBAL]: 'bg-gd/10 text-gd',
  [AccessScope.MULTI]: 'bg-blue-50 text-blue-600',
  [AccessScope.SINGLE]: 'bg-gray-100 text-gray-600',
}

export function Badge({ label, variant = 'default', value, className }: BadgeProps) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-sora whitespace-nowrap'

  if (variant === 'role' && value && value in UserRole) {
    return (
      <span className={clsx(base, ROLE_STYLES[value as UserRole], className)}>
        {label}
      </span>
    )
  }

  if (variant === 'scope' && value && value in AccessScope) {
    return (
      <span className={clsx(base, SCOPE_STYLES[value as AccessScope], className)}>
        {label}
      </span>
    )
  }

  return (
    <span className={clsx(base, 'bg-gray-100 text-gray-600', className)}>
      {label}
    </span>
  )
}
