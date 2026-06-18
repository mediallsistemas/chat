'use client'

import { useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { MetricCard, PageHeader } from '@/shared/components'
import { TrafficLight, ProgressBar, Button, Input, Select } from '@/shared/components/ui'
import { useDashboard } from '@/features/dashboard/hooks/use-dashboard'
import { ResolveImpedimentButton, ArchivePlanButton } from '@/features/dashboard/components'
import { useDownloadDashboardPdf } from '@/features/reports/hooks/use-reports'
import type { TrafficLightStatus } from '@/shared/components/ui'

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gs/60 rounded-xl ${className}`} />
}

type FarolFilter = 'ALL' | 'GREEN' | 'YELLOW' | 'RED'

const FAROL_OPTIONS: { value: FarolFilter; label: string; status: TrafficLightStatus | null }[] = [
  { value: 'ALL', label: 'Todos', status: null },
  { value: 'RED', label: 'Atrasado', status: 'RED' },
  { value: 'YELLOW', label: 'Atenção', status: 'YELLOW' },
  { value: 'GREEN', label: 'No prazo', status: 'GREEN' },
]

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard()
  const { download: downloadPdf, isPending: exportingPdf } = useDownloadDashboardPdf()

  // Painel filters — in-memory UI state, not domain data (ui.md §5/§8).
  const [search, setSearch] = useState('')
  const [farol, setFarol] = useState<FarolFilter>('ALL')
  const [unitType, setUnitType] = useState<string>('ALL')

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader title="Painel da Diretoria" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader title="Painel da Diretoria" />
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-sm text-red-700">
          Erro ao carregar dados do painel. Tente novamente.
        </div>
      </div>
    )
  }

  const { metrics, units, plans, impediments } = data

  const metricCards = [
    {
      label: 'Planos Ativos',
      value: metrics.totalPlans,
      icon: 'ti-chart-arrows',
    },
    {
      label: 'Impedimentos Abertos',
      value: metrics.openImpediments,
      icon: 'ti-alert-triangle',
      iconColor: metrics.openImpediments > 0 ? 'text-red-500' : undefined,
    },
    {
      label: 'Tarefas Atrasadas',
      value: metrics.overdueTasks,
      icon: 'ti-alarm',
      iconColor: metrics.overdueTasks > 0 ? 'text-yellow-500' : undefined,
    },
    {
      label: 'Metas em Risco',
      value: metrics.goalsAtRisk,
      icon: 'ti-trending-down',
      iconColor: metrics.goalsAtRisk > 0 ? 'text-red-500' : undefined,
    },
  ]

  // Apply in-memory filters (search by name, farol, unit type) to each consolidated block.
  const q = search.trim().toLowerCase()
  const unitTypes = Array.from(new Set(units.map((u) => u.type))).sort()
  const filtersActive = q !== '' || farol !== 'ALL' || unitType !== 'ALL'

  const filteredUnits = units.filter(
    (u) =>
      (farol === 'ALL' || u.status === farol) &&
      (unitType === 'ALL' || u.type === unitType) &&
      (q === '' || u.name.toLowerCase().includes(q)),
  )
  const filteredPlans = plans.filter(
    (p) =>
      (farol === 'ALL' || p.trafficLight === farol) &&
      (q === '' || p.name.toLowerCase().includes(q) || p.unitName.toLowerCase().includes(q)),
  )
  const criticalImpediments = impediments
    .filter((i) => i.escalationLevel >= 1)
    .filter((i) => q === '' || i.taskTitle.toLowerCase().includes(q))
    .slice(0, 5)

  function clearFilters() {
    setSearch('')
    setFarol('ALL')
    setUnitType('ALL')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Painel da Diretoria" />
        <Button variant="secondary" size="sm" onClick={downloadPdf} loading={exportingPdf} aria-label="Exportar relatório executivo em PDF">
          <i className="ti ti-file-type-pdf mr-1.5 text-red-500" />
          Exportar PDF
        </Button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metricCards.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-gs/60 px-4 py-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar unidade ou plano..."
            aria-label="Buscar unidade ou plano"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-gs p-1" role="group" aria-label="Filtrar por farol">
          {FAROL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFarol(opt.value)}
              aria-pressed={farol === opt.value}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                farol === opt.value ? 'bg-gd text-white' : 'text-gx hover:bg-page-bg',
              )}
            >
              {opt.status && <TrafficLight status={opt.status} size="sm" />}
              {opt.label}
            </button>
          ))}
        </div>

        <div className="w-44">
          <Select
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
            aria-label="Filtrar por tipo de unidade"
          >
            <option value="ALL">Todos os tipos</option>
            {unitTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>

        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters} aria-label="Limpar filtros">
            <i className="ti ti-x mr-1" aria-hidden="true" />
            Limpar
          </Button>
        )}
      </div>

      {/* Units traffic light grid */}
      {units.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 font-sora mb-3">Situação das Unidades</h2>
          {filteredUnits.length === 0 ? (
            <p className="text-sm text-gx bg-white rounded-2xl border border-gs/60 px-5 py-6 text-center">
              Nenhuma unidade corresponde aos filtros.
            </p>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {filteredUnits.map((unit) => (
              <Link
                key={unit.id}
                href={`/dashboard/unidades/${unit.id}`}
                className="block bg-white rounded-2xl p-4 border border-gs/60 hover:border-gd/40 hover:shadow-sm transition-all group"
                aria-label={`Abrir cockpit da unidade ${unit.name}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-800 font-sora truncate group-hover:text-gd">{unit.name}</span>
                  <TrafficLight status={unit.status as TrafficLightStatus} size="md" />
                </div>
                <ProgressBar value={unit.progress} showLabel size="sm" />
                <div className="flex items-center gap-3 mt-2 text-xs text-gx">
                  <span>
                    <i className="ti ti-chart-arrows mr-1" aria-hidden="true" />
                    {unit.plans} {unit.plans === 1 ? 'plano' : 'planos'}
                  </span>
                  {unit.impediments > 0 && (
                    <span className="text-red-500">
                      <i className="ti ti-alert-triangle mr-1" aria-hidden="true" />
                      {unit.impediments} impend.
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
          )}
        </section>
      )}

      {/* Two-column panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Critical impediments */}
        <section className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gs/60">
            <h2 className="text-sm font-semibold text-gray-700 font-sora">Impedimentos Críticos</h2>
            <Link href="/impedimentos" className="text-xs text-gm hover:text-gd font-medium">
              Ver todos →
            </Link>
          </div>
          <div className="divide-y divide-gs/40">
            {criticalImpediments.length === 0 && (
              <p className="text-xs text-gx px-5 py-4">Nenhum impedimento crítico.</p>
            )}
            {criticalImpediments.map((imp) => (
              <div key={imp.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                  <i className="ti ti-alert-triangle text-red-500 text-base" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{imp.taskTitle}</p>
                  <p className="text-xs text-gx mt-0.5">
                    {imp.daysOpen}d bloqueado
                    {imp.escalationLevel >= 2 && (
                      <span className="ml-2 text-red-600 font-semibold">· Escalado p/ Diretoria</span>
                    )}
                    {imp.escalationLevel === 1 && (
                      <span className="ml-2 text-orange-600 font-semibold">· Escalado p/ Gerência</span>
                    )}
                  </p>
                </div>
                <div className="shrink-0 self-center">
                  <ResolveImpedimentButton
                    unitId={imp.unitId}
                    impedimentId={imp.id}
                    taskTitle={imp.taskTitle}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Strategic plans */}
        <section className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gs/60">
            <h2 className="text-sm font-semibold text-gray-700 font-sora">Planos Estratégicos</h2>
            <Link href="/processos" className="text-xs text-gm hover:text-gd font-medium">
              Ver todos →
            </Link>
          </div>
          <div className="divide-y divide-gs/40">
            {filteredPlans.length === 0 && (
              <p className="text-xs text-gx px-5 py-4">
                {plans.length === 0 ? 'Nenhum plano ativo.' : 'Nenhum plano corresponde aos filtros.'}
              </p>
            )}
            {filteredPlans.slice(0, 5).map((plan) => (
              <div key={plan.id} className="flex items-center gap-3 px-5 py-3.5">
                <TrafficLight status={plan.trafficLight as TrafficLightStatus} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{plan.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-xs text-gx">{plan.year}</span>
                    {(plan.attachedUnits?.length ?? 0) > 0 && (
                      <>
                        <span className="text-xs text-gx" aria-hidden="true">·</span>
                        {plan.attachedUnits.slice(0, 3).map((u) => (
                          <span
                            key={u.id}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-page-bg text-gx border border-gs/60"
                          >
                            {u.name}
                          </span>
                        ))}
                        {plan.attachedUnits.length > 3 && (
                          <span className="text-[10px] text-gx">+{plan.attachedUnits.length - 3}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="w-24 shrink-0">
                  <ProgressBar value={plan.progress} showLabel size="sm" />
                </div>
                <ArchivePlanButton unitId={plan.unitId} planId={plan.id} planName={plan.name} />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Proactive alerts */}
      {(metrics.overdueTasks > 0 || metrics.goalsAtRisk > 0 || metrics.openImpediments > 0) && (
        <section
          className="bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-4"
          aria-label="Alertas proativos"
        >
          <div className="flex items-center gap-2 mb-2">
            <i className="ti ti-bell-ringing text-yellow-600 text-base" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-yellow-800 font-sora">Alertas</h2>
          </div>
          <ul className="space-y-1">
            {metrics.overdueTasks > 0 && (
              <li className="text-sm text-yellow-700 flex items-center gap-2">
                <i className="ti ti-clock text-yellow-500 text-xs shrink-0" aria-hidden="true" />
                {metrics.overdueTasks} {metrics.overdueTasks === 1 ? 'tarefa vencida' : 'tarefas vencidas'} sem conclusão
              </li>
            )}
            {metrics.goalsAtRisk > 0 && (
              <li className="text-sm text-yellow-700 flex items-center gap-2">
                <i className="ti ti-trending-down text-yellow-500 text-xs shrink-0" aria-hidden="true" />
                {metrics.goalsAtRisk} {metrics.goalsAtRisk === 1 ? 'meta em risco' : 'metas em risco'} de não atingir o alvo
              </li>
            )}
            {metrics.openImpediments > 0 && (
              <li className="text-sm text-yellow-700 flex items-center gap-2">
                <i className="ti ti-alert-triangle text-yellow-500 text-xs shrink-0" aria-hidden="true" />
                {metrics.openImpediments} {metrics.openImpediments === 1 ? 'impedimento aberto' : 'impedimentos abertos'}
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  )
}
