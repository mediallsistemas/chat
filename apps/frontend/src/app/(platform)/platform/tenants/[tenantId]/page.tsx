'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button, Modal, SkeletonList, Select } from '@/shared/components/ui'
import { PlanTier, TenantStatus, TIER_LIMITS } from '@mediall/types'
import { TenantStatusBadge } from '@/features/platform/components'
import {
  usePlatformTenant,
  useSuspendTenant,
  useReactivateTenant,
  useChangeTier,
  useImpersonateTenant,
} from '@/features/platform/hooks/use-platform'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gs/40 last:border-0">
      <dt className="text-sm text-gx">{label}</dt>
      <dd className="text-sm text-gray-800 text-right">{value}</dd>
    </div>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PlatformTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const { data: t, isLoading, isError, refetch } = usePlatformTenant(tenantId)
  const suspend = useSuspendTenant(tenantId)
  const reactivate = useReactivateTenant(tenantId)
  const changeTier = useChangeTier(tenantId)
  const impersonate = useImpersonateTenant(tenantId)

  const [confirmImpersonate, setConfirmImpersonate] = useState(false)

  if (isLoading) return <div className="max-w-2xl mx-auto"><SkeletonList count={4} /></div>

  if (isError || !t) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <i className="ti ti-alert-triangle text-3xl text-gs" aria-hidden="true" />
        <p className="text-sm text-gx">Não foi possível carregar a organização.</p>
        <Button size="sm" variant="secondary" onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    )
  }

  const isBlocked = t.status === TenantStatus.SUSPENDED || t.status === TenantStatus.CANCELED

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/platform/tenants" className="text-xs text-gx hover:underline">
          <i className="ti ti-arrow-left mr-1" aria-hidden="true" />Organizações
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-bold text-gd font-sora">{t.name}</h1>
          <TenantStatusBadge status={t.status} />
        </div>
        <p className="text-sm text-gx mt-1">{t.slug}</p>
      </div>

      <section className="bg-white rounded-2xl border border-gs p-6">
        <h2 className="text-sm font-semibold text-gd font-sora mb-3">Detalhes</h2>
        <dl>
          <Field label="Plano" value={TIER_LIMITS[t.tier as PlanTier].label} />
          <Field label="Unidades" value={`${t.unitCount}${t.maxUnits > 0 ? ` / ${t.maxUnits}` : ' / ∞'}`} />
          <Field label="Usuários" value={`${t.userCount}${t.maxUsers > 0 ? ` / ${t.maxUsers}` : ' / ∞'}`} />
          <Field label="Assinatura" value={t.subscriptionStatus ?? '—'} />
          <Field label="Próxima cobrança" value={formatDate(t.currentPeriodEnd)} />
          <Field label="Teste termina" value={formatDate(t.trialEndsAt)} />
          <Field label="Cliente (Stripe)" value={t.providerCustomerId ?? '—'} />
          <Field label="Criada em" value={formatDate(t.createdAt)} />
        </dl>
      </section>

      <section className="bg-white rounded-2xl border border-gs p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gd font-sora">Ações</h2>

        {/* Change tier */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-800">Plano de assinatura</p>
            <p className="text-xs text-gx">Alterar o tier aplica os novos limites (sem apagar dados).</p>
          </div>
          <Select
            value={t.tier}
            disabled={changeTier.isPending}
            onChange={(e) => {
              const tier = e.target.value as PlanTier
              if (tier !== t.tier) changeTier.mutate(tier)
            }}
            className="w-40"
          >
            {Object.values(PlanTier).map((tier) => (
              <option key={tier} value={tier}>{TIER_LIMITS[tier].label}</option>
            ))}
          </Select>
        </div>

        {/* Suspend / reactivate */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-gs/40">
          <div>
            <p className="text-sm text-gray-800">{isBlocked ? 'Reativar acesso' : 'Suspender acesso'}</p>
            <p className="text-xs text-gx">
              {isBlocked
                ? 'Libera o acesso de edição da organização.'
                : 'Coloca a organização em modo somente-leitura.'}
            </p>
          </div>
          {isBlocked ? (
            <Button variant="primary" size="sm" loading={reactivate.isPending} onClick={() => reactivate.mutate()}>
              Reativar
            </Button>
          ) : (
            <Button variant="danger" size="sm" loading={suspend.isPending} onClick={() => suspend.mutate()}>
              Suspender
            </Button>
          )}
        </div>

        {/* Impersonate */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-gs/40">
          <div>
            <p className="text-sm text-gray-800">Impersonar para suporte</p>
            <p className="text-xs text-gx">Entra como um administrador desta organização. Ação auditada.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setConfirmImpersonate(true)}>
            Impersonar
          </Button>
        </div>
      </section>

      <Modal
        open={confirmImpersonate}
        onClose={() => setConfirmImpersonate(false)}
        title="Impersonar organização"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmImpersonate(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={impersonate.isPending}
              onClick={() => impersonate.mutate()}
            >
              Confirmar
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          Você entrará como administrador de <strong>{t.name}</strong> e enxergará apenas os dados
          dessa organização. A ação fica registrada na auditoria. Para voltar, faça logout e entre
          novamente como administrador da plataforma.
        </p>
      </Modal>
    </div>
  )
}
