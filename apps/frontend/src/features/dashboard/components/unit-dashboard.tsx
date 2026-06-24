'use client'

import Link from 'next/link'
import { MetricCard } from '@/shared/components'
import { TrafficLight, ProgressBar, Button } from '@/shared/components/ui'
import type { TrafficLightStatus } from '@/shared/components/ui'
import { useDashboardUnit } from '../hooks/use-dashboard-unit'
import { useDashboardTrends } from '../hooks/use-dashboard'
import { ResolveImpedimentButton, ArchivePlanButton } from './inline-actions'
import { TrendCharts } from './dashboard-charts'

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gs/60 rounded-xl ${className}`} />
}

/**
 * Scope-aware dashboard for a single unit (header "uma unidade"). Mirrors the
 * consolidated panel but narrowed to `unitId`: metrics, the unit's own trend
 * charts, active plans (with this unit's objectives) and open impediments.
 * Data comes from GET /dashboard/units/:unitId and /dashboard/trends?unitId.
 */
export function UnitDashboard({ unitId }: { unitId: string }) {
  const { data, isLoading, isError, refetch } = useDashboardUnit(unitId)
  const {
    data: trends,
    isLoading: trendsLoading,
    isError: trendsError,
    refetch: refetchTrends,
  } = useDashboardTrends(unitId)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-56" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <i className="ti ti-alert-triangle text-3xl text-gs" aria-hidden="true" />
        <p className="text-sm text-gx">Não foi possível carregar os dados da unidade. Tente novamente.</p>
        <Button size="sm" variant="secondary" onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    )
  }

  const { unit, plans, impediments, metrics } = data

  const metricCards = [
    { label: 'Planos Ativos', value: metrics.activePlans, icon: 'ti-chart-arrows' },
    { label: 'Total de Tarefas', value: metrics.totalTasks, icon: 'ti-checkbox' },
    {
      label: 'Tarefas Atrasadas',
      value: metrics.overdueTasks,
      icon: 'ti-alarm',
      iconColor: metrics.overdueTasks > 0 ? 'text-yellow-500' : undefined,
    },
    {
      label: 'Impedimentos Abertos',
      value: metrics.openImpediments,
      icon: 'ti-alert-triangle',
      iconColor: metrics.openImpediments > 0 ? 'text-red-500' : undefined,
    },
  ]

  return (
    <div className="space-y-6">
      {unit.manager && (
        <p className="text-sm text-gx -mt-2">
          Gestor: <span className="font-medium text-gray-700">{unit.manager.name}</span>
        </p>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {metricCards.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Time-series scoped to this unit */}
      <TrendCharts
        trends={trends}
        loading={trendsLoading}
        error={trendsError}
        onRetry={refetchTrends}
      />

      {/* Plans with this unit's objectives */}
      {plans.length > 0 ? (
        <section className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-gs/60">
            <h2 className="text-sm font-semibold text-gray-700 font-sora">Planos Estratégicos</h2>
          </div>
          <div className="divide-y divide-gs/40">
            {plans.map((plan) => (
              <div key={plan.id} className="px-5 py-4">
                <div className="flex items-center gap-3 mb-3">
                  <TrafficLight status={plan.trafficLight as TrafficLightStatus} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{plan.name}</p>
                    <p className="text-xs text-gx">{plan.year}</p>
                  </div>
                  <div className="w-28 shrink-0">
                    <ProgressBar value={plan.progress} showLabel size="sm" />
                  </div>
                  <ArchivePlanButton unitId={unitId} planId={plan.id} planName={plan.name} />
                </div>
                {plan.objectives.length > 0 && (
                  <div className="ml-9 space-y-1.5">
                    {plan.objectives.map((obj) => (
                      <Link
                        key={obj.id}
                        href={`/processos/${plan.id}/${obj.id}`}
                        className="flex items-center gap-2 text-xs text-gray-600 hover:text-gm group"
                      >
                        <TrafficLight status={obj.trafficLight as TrafficLightStatus} size="sm" />
                        <span className="truncate group-hover:underline">{obj.title}</span>
                        <span className="ml-auto shrink-0 text-gx">{Math.round(Number(obj.progressPct))}%</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="bg-white rounded-2xl border border-gs/60 px-5 py-10 text-center">
          <i className="ti ti-file-off text-3xl text-gs mb-2 block" aria-hidden="true" />
          <p className="text-sm text-gx">Nenhum plano estratégico ativo nesta unidade.</p>
          <Link href="/processos" className="text-sm text-gd hover:underline mt-2 inline-block">
            Ver planos
          </Link>
        </div>
      )}

      {/* Open impediments */}
      {impediments.length > 0 && (
        <section className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-gs/60">
            <h2 className="text-sm font-semibold text-gray-700 font-sora">Impedimentos Abertos</h2>
          </div>
          <div className="divide-y divide-gs/40">
            {impediments.map((imp) => (
              <div key={imp.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                  <i className="ti ti-alert-triangle text-red-500 text-base" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{imp.taskTitle}</p>
                  <p className="text-xs text-gx mt-0.5">
                    {imp.daysOpen}d bloqueado · {imp.description}
                  </p>
                </div>
                {imp.escalationLevel >= 2 && (
                  <span className="text-xs text-red-600 font-semibold shrink-0 self-center">Diretoria</span>
                )}
                {imp.escalationLevel === 1 && (
                  <span className="text-xs text-orange-600 font-semibold shrink-0 self-center">Gerência</span>
                )}
                <div className="shrink-0 self-center">
                  <ResolveImpedimentButton unitId={unitId} impedimentId={imp.id} taskTitle={imp.taskTitle} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
