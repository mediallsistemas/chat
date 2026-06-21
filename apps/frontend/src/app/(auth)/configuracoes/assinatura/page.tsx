'use client'

import { clsx } from 'clsx'
import { Button, SkeletonList } from '@/shared/components/ui'
import {
  PlanTier,
  TenantStatus,
  TIER_LIMITS,
  type SubscriptionView,
} from '@mediall/types'
import {
  useMySubscription,
  useBillingPortal,
  useCheckout,
} from '@/features/billing/hooks/use-billing'

const TENANT_STATUS_LABEL: Record<TenantStatus, { label: string; cls: string }> = {
  [TenantStatus.TRIAL]: { label: 'Período de teste', cls: 'bg-gn/20 text-gd' },
  [TenantStatus.ACTIVE]: { label: 'Ativa', cls: 'bg-green-100 text-green-700' },
  [TenantStatus.PAST_DUE]: { label: 'Fatura em aberto', cls: 'bg-amber-100 text-amber-700' },
  [TenantStatus.SUSPENDED]: { label: 'Suspensa', cls: 'bg-red-100 text-red-700' },
  [TenantStatus.CANCELED]: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
}

const TIER_ORDER: PlanTier[] = [PlanTier.STARTER, PlanTier.PRO, PlanTier.ENTERPRISE]

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gs p-6">
      <h2 className="text-sm font-semibold text-gd font-sora mb-4">{title}</h2>
      {children}
    </div>
  )
}

function UsageBar({ label, used, max }: { label: string; used: number; max: number | null }) {
  const unlimited = max === null
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, max)) * 100))
  const atLimit = !unlimited && used >= max
  return (
    <div className="py-2">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className={clsx('font-medium', atLimit ? 'text-red-600' : 'text-gx')}>
          {used} {unlimited ? '/ ∞' : `/ ${max}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gs/50 overflow-hidden">
        <div
          className={clsx('h-full rounded-full', atLimit ? 'bg-red-500' : 'bg-gd')}
          style={{ width: unlimited ? '8%' : `${pct}%` }}
        />
      </div>
    </div>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function CurrentPlanCard({ sub, onPortal, portalPending }: {
  sub: SubscriptionView
  onPortal: () => void
  portalPending: boolean
}) {
  const status = TENANT_STATUS_LABEL[sub.tenantStatus]
  return (
    <SectionCard title="Plano atual">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gd font-sora">{sub.limits.label}</span>
            <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', status.cls)}>
              {status.label}
            </span>
          </div>
          <dl className="mt-3 space-y-1 text-sm text-gx">
            {sub.tenantStatus === TenantStatus.TRIAL && (
              <div className="flex gap-2">
                <dt>Teste termina em:</dt>
                <dd className="text-gray-700">{formatDate(sub.trialEndsAt)}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt>Próxima cobrança:</dt>
              <dd className="text-gray-700">{formatDate(sub.currentPeriodEnd)}</dd>
            </div>
            {sub.cancelAtPeriodEnd && (
              <div className="text-amber-700">Será cancelada ao fim do período.</div>
            )}
          </dl>
        </div>
        <Button variant="secondary" size="sm" onClick={onPortal} loading={portalPending}>
          Gerenciar pagamento
        </Button>
      </div>

      <div className="mt-4 pt-4 border-t border-gs/40">
        <p className="text-xs text-gx font-medium mb-1">Uso do plano</p>
        <UsageBar label="Unidades" used={sub.usage.units} max={sub.limits.maxUnits} />
        <UsageBar label="Usuários" used={sub.usage.users} max={sub.limits.maxUsers} />
      </div>
    </SectionCard>
  )
}

export default function AssinaturaPage() {
  const { data: sub, isLoading, isError, refetch } = useMySubscription()
  const portal = useBillingPortal()
  const checkout = useCheckout()

  if (isLoading) return <div className="max-w-3xl mx-auto"><SkeletonList count={3} /></div>

  if (isError || !sub) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <i className="ti ti-alert-triangle text-3xl text-gs" aria-hidden="true" />
        <p className="text-sm text-gx">Não foi possível carregar a assinatura. Tente novamente.</p>
        <Button size="sm" variant="secondary" onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gd font-sora">Assinatura</h1>
        <p className="text-sm text-gx mt-1">Gerencie o plano, o pagamento e os limites da sua organização.</p>
      </div>

      <CurrentPlanCard sub={sub} onPortal={() => portal.mutate()} portalPending={portal.isPending} />

      <SectionCard title="Planos disponíveis">
        <div className="grid gap-4 sm:grid-cols-3">
          {TIER_ORDER.map((tier) => {
            const limits = TIER_LIMITS[tier]
            const isCurrent = sub.tier === tier
            return (
              <div
                key={tier}
                className={clsx(
                  'rounded-xl border p-4 flex flex-col gap-3',
                  isCurrent ? 'border-gd ring-1 ring-gd bg-gn/5' : 'border-gs',
                )}
              >
                <div>
                  <p className="font-semibold text-gd font-sora">{limits.label}</p>
                  <p className="text-xs text-gx mt-1">
                    {limits.maxUnits === null ? 'Unidades ilimitadas' : `Até ${limits.maxUnits} unidades`}
                    {' · '}
                    {limits.maxUsers === null ? 'usuários ilimitados' : `${limits.maxUsers} usuários`}
                  </p>
                </div>
                {isCurrent ? (
                  <span className="text-xs font-semibold text-gd mt-auto">Plano atual</span>
                ) : tier === PlanTier.ENTERPRISE ? (
                  <span className="text-xs text-gx mt-auto">Fale com o comercial</span>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    className="mt-auto"
                    loading={checkout.isPending}
                    onClick={() => {
                      const priceId =
                        tier === PlanTier.STARTER
                          ? process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER
                          : process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO
                      checkout.mutate(priceId ?? tier)
                    }}
                  >
                    Mudar para {limits.label}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gx mt-4">
          A cobrança é processada com segurança pelo provedor de pagamento. Alterações de plano
          entram em vigor após a confirmação do pagamento.
        </p>
      </SectionCard>
    </div>
  )
}
