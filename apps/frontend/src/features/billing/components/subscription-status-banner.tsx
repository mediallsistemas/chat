'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { TenantStatus } from '@mediall/types'
import { useMySubscription } from '../hooks/use-billing'

/**
 * Global billing banner (plano 26.6). Shows a warning while the tenant is
 * PAST_DUE and a block notice while SUSPENDED/CANCELED (access is read-only).
 * Silent for healthy tenants. Rendered in the authenticated layout so it appears
 * on every screen until the customer regularizes.
 */
export function SubscriptionStatusBanner() {
  // Non-admins (COLABORADOR/VISUALIZADOR) get a 403 on /billing/me — keep the
  // banner quiet for them rather than surfacing an error.
  const { data } = useMySubscription()
  if (!data) return null

  const status = data.tenantStatus
  const blocked =
    status === TenantStatus.SUSPENDED || status === TenantStatus.CANCELED
  const pastDue = status === TenantStatus.PAST_DUE
  if (!blocked && !pastDue) return null

  return (
    <div
      role="alert"
      className={clsx(
        'flex items-center gap-3 px-6 py-2.5 text-sm border-b',
        blocked
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-amber-50 border-amber-200 text-amber-800',
      )}
    >
      <i
        className={clsx('ti text-lg', blocked ? 'ti-lock' : 'ti-alert-triangle')}
        aria-hidden="true"
      />
      <span className="flex-1">
        {blocked
          ? 'Assinatura suspensa. O acesso está em modo somente-leitura — regularize o pagamento para voltar a editar.'
          : 'Há uma fatura em aberto. Regularize o pagamento para evitar a suspensão do acesso.'}
      </span>
      <Link
        href="/configuracoes/assinatura"
        className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
      >
        Ver assinatura
      </Link>
    </div>
  )
}
