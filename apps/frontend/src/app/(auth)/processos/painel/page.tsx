'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { PageHeader, MetricCard } from '@/shared/components'
import { ProgressBar, TrafficLight } from '@/shared/components/ui'
import { useStrategicPanel } from '@/features/strategic/hooks/use-strategic'
import { useUnitStore } from '@/store/unit-store'
import type { TrafficLightStatus } from '@/shared/components/ui'

const TRAFFIC_LIGHT_MAP: Record<string, TrafficLightStatus> = {
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  RED: 'RED',
}

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Não iniciado',
  IN_PROGRESS: 'Em andamento',
  AT_RISK: 'Em risco',
  DONE: 'Concluído',
}

function PanelSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-24 rounded-2xl bg-gs/30 animate-pulse" />
        ))}
      </div>
      <div className="space-y-4">
        {[1, 2].map((n) => (
          <div key={n} className="h-48 rounded-2xl bg-gs/30 animate-pulse" />
        ))}
      </div>
    </div>
  )
}

export default function PainelEstrategicoPage() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const { data, isLoading } = useStrategicPanel(activeUnit?.id)

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Painel Estratégico" />
        <Link
          href="/processos"
          className="text-sm text-gd hover:underline flex items-center gap-1"
        >
          <i className="ti ti-layout-list text-base" />
          Ver planos completos
        </Link>
      </div>

      {isLoading && <PanelSkeleton />}

      {!isLoading && !data && (
        <div className="bg-white rounded-2xl border border-gs/60 py-16 text-center">
          <i className="ti ti-chart-bar-off text-4xl text-gx opacity-50 block mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-800">Não foi possível carregar o painel</p>
          <p className="text-xs text-gx mt-1">
            Verifique se há uma unidade selecionada ou tente novamente em instantes.
          </p>
        </div>
      )}

      {data && (
        <>
          {/* Summary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard
              label="Planos ativos"
              value={data.activePlansCount}
              icon="ti-file-analytics"
              iconColor="text-gd"
            />
            <MetricCard
              label="Etapas em andamento"
              value={data.activePhasesCount}
              icon="ti-player-play"
              iconColor="text-blue-500"
            />
            <MetricCard
              label="Metas em risco"
              value={data.atRiskGoals}
              icon="ti-alert-triangle"
              iconColor="text-yellow-500"
            />
            <MetricCard
              label="Macro-tarefas bloqueadas"
              value={data.blockedMacroTasks}
              icon="ti-lock"
              iconColor="text-red-500"
            />
          </div>

          {/* Progress summary */}
          {data.totalObjectives > 0 && (
            <div className="bg-white rounded-2xl border border-gs/60 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-800">Progresso geral dos objetivos</h2>
                <span className="text-xs text-gx">
                  {data.doneObjectives}/{data.totalObjectives} concluídos
                </span>
              </div>
              <ProgressBar
                value={Math.round((data.doneObjectives / data.totalObjectives) * 100)}
                showLabel
              />
              {data.overduePhases > 0 && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <i className="ti ti-clock-exclamation" aria-hidden="true" />
                  {data.overduePhases} etapa{data.overduePhases !== 1 ? 's' : ''} com prazo vencido
                </p>
              )}
            </div>
          )}

          {/* Plans detail */}
          {data.plans.length === 0 ? (
            <div className="py-16 text-center">
              <i className="ti ti-file-off text-4xl text-gs mb-3 block" aria-hidden="true" />
              <p className="text-sm text-gx">Nenhum plano estratégico ativo</p>
              <Link href="/processos" className="text-sm text-gd hover:underline mt-2 inline-block">
                Criar plano
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {data.plans.map((plan) => (
                <div key={plan.id} className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gs/40 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">{plan.name}</h2>
                      <p className="text-xs text-gx mt-0.5">Plano {plan.year}</p>
                    </div>
                    <Link
                      href={`/processos`}
                      className="text-xs text-gd hover:underline flex items-center gap-1"
                    >
                      Detalhar
                      <i className="ti ti-arrow-right text-xs" />
                    </Link>
                  </div>

                  {/* Objectives list */}
                  <div className="divide-y divide-gs/30">
                    {plan.objectives.map((obj) => {
                      const progress = Math.round(Number(obj.progressPct))
                      const tl = TRAFFIC_LIGHT_MAP[obj.trafficLight] ?? 'GREEN'
                      const activePhases = obj.goals.flatMap((g) => g.phases)

                      return (
                        <div key={obj.id} className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <TrafficLight status={tl} size="sm" className="mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm font-medium text-gray-800 truncate">{obj.title}</p>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className={clsx(
                                      'text-[11px] px-1.5 py-0.5 rounded-full font-medium',
                                      obj.status === 'DONE' ? 'bg-green-50 text-green-700' :
                                      obj.status === 'AT_RISK' ? 'bg-red-50 text-red-600' :
                                      'bg-page-bg text-gx',
                                    )}
                                  >
                                    {STATUS_LABEL[obj.status] ?? obj.status}
                                  </span>
                                  <span className="text-xs font-semibold text-gray-700 w-9 text-right">
                                    {progress}%
                                  </span>
                                </div>
                              </div>
                              <ProgressBar value={progress} size="sm" />

                              {/* Active phases for this objective */}
                              {activePhases.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {activePhases.map((phase) => {
                                    const isOverdue = phase.dueDate && new Date(phase.dueDate) < new Date()
                                    return (
                                      <span
                                        key={phase.id}
                                        className={clsx(
                                          'text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1',
                                          isOverdue
                                            ? 'bg-red-50 text-red-600'
                                            : 'bg-blue-50 text-blue-700',
                                        )}
                                      >
                                        <i className="ti ti-player-play text-[10px]" aria-hidden="true" />
                                        {phase.title}
                                        {phase._count.macroTasks > 0 && (
                                          <span className="opacity-70">
                                            · {phase._count.macroTasks}
                                          </span>
                                        )}
                                        {isOverdue && (
                                          <i className="ti ti-clock-exclamation text-[10px]" aria-hidden="true" />
                                        )}
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
