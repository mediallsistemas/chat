import { clsx } from 'clsx'
import { TenantStatus } from '@mediall/types'

const STATUS_CLS: Record<TenantStatus, string> = {
  [TenantStatus.TRIAL]: 'bg-gn/20 text-gd',
  [TenantStatus.ACTIVE]: 'bg-green-100 text-green-700',
  [TenantStatus.PAST_DUE]: 'bg-amber-100 text-amber-700',
  [TenantStatus.SUSPENDED]: 'bg-red-100 text-red-700',
  [TenantStatus.CANCELED]: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<TenantStatus, string> = {
  [TenantStatus.TRIAL]: 'Teste',
  [TenantStatus.ACTIVE]: 'Ativa',
  [TenantStatus.PAST_DUE]: 'Em aberto',
  [TenantStatus.SUSPENDED]: 'Suspensa',
  [TenantStatus.CANCELED]: 'Cancelada',
}

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', STATUS_CLS[status])}>
      {STATUS_LABEL[status]}
    </span>
  )
}
