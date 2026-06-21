'use client'

import Link from 'next/link'
import { SkeletonList, Button, EmptyState } from '@/shared/components/ui'
import { TIER_LIMITS, type PlanTier } from '@mediall/types'
import { usePlatformTenants } from '@/features/platform/hooks/use-platform'
import { TenantStatusBadge } from '@/features/platform/components'

export default function PlatformTenantsPage() {
  const { data, isLoading, isError, refetch } = usePlatformTenants()

  if (isLoading) return <SkeletonList count={5} />

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <i className="ti ti-alert-triangle text-3xl text-gs" aria-hidden="true" />
        <p className="text-sm text-gx">Não foi possível carregar as organizações.</p>
        <Button size="sm" variant="secondary" onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return <EmptyState icon="ti-building-community" title="Nenhuma organização" description="Ainda não há clientes cadastrados na plataforma." />
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gd font-sora">Organizações</h1>
        <p className="text-sm text-gx mt-1">Clientes (tenants) da plataforma — {data.length} no total.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gs overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gs text-left text-xs uppercase tracking-wide text-gx">
              <th className="px-4 py-3 font-semibold">Organização</th>
              <th className="px-4 py-3 font-semibold">Plano</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-center">Unidades</th>
              <th className="px-4 py-3 font-semibold text-center">Usuários</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data.map((t) => (
              <tr key={t.id} className="border-b border-gs/40 last:border-0 hover:bg-page-bg/60">
                <td className="px-4 py-3">
                  <Link href={`/platform/tenants/${t.id}`} className="font-medium text-gd hover:underline">
                    {t.name}
                  </Link>
                  <span className="block text-xs text-gx">{t.slug}</span>
                </td>
                <td className="px-4 py-3 text-gray-700">{TIER_LIMITS[t.tier as PlanTier].label}</td>
                <td className="px-4 py-3"><TenantStatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-center text-gray-700">{t.unitCount}</td>
                <td className="px-4 py-3 text-center text-gray-700">{t.userCount}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/platform/tenants/${t.id}`} className="text-xs font-semibold text-gd hover:underline">
                    Gerenciar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
