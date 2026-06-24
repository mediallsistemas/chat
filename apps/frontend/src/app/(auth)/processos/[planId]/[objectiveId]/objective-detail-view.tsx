'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePlanDetail, useGoals, usePlanUnit } from '@/features/strategic/hooks/use-strategic'
import { useUnits } from '@/features/units/hooks/use-units'
import { ProgressBar, TrafficLight } from '@/shared/components/ui'
import type { TrafficLightStatus } from '@/shared/components/ui'
import { TrafficLight as TL, PhaseStatus } from '@mediall/types'
import { clsx } from 'clsx'

const PHASE_CFG: Record<PhaseStatus, { label: string; icon: string; bg: string; text: string }> = {
  ARCHIVED: { label: 'Concluída', icon: 'ti-check', bg: 'bg-gd', text: 'text-white' },
  ACTIVE: { label: 'Em andamento', icon: 'ti-player-play', bg: 'bg-gn', text: 'text-gd' },
  LOCKED: { label: 'Bloqueada', icon: 'ti-lock', bg: 'bg-white border-2 border-gs', text: 'text-gx' },
}

export function ObjectiveDetailView({ planId, objectiveId }: { planId: string; objectiveId: string }) {
  const { activeUnit, units, switchUnit } = useUnits()

  // Resolve which unit owns this plan; auto-switch active unit when it diverges
  // so deep links from other units (e.g. an objective link from the dashboard)
  // work after refresh.
  const { data: planUnit, isLoading: planUnitLoading } = usePlanUnit(planId)
  useEffect(() => {
    if (!planUnit || !units.length) return
    if (activeUnit?.id === planUnit.unitId) return
    const target = units.find((u) => u.id === planUnit.unitId)
    if (target) switchUnit(target)
  }, [planUnit, units, activeUnit?.id, switchUnit])

  const unitId = activeUnit?.id === planUnit?.unitId ? activeUnit?.id : undefined

  const { data: plan, isLoading: planLoading } = usePlanDetail(unitId, planId)
  const { data: goals = [], isLoading: goalsLoading } = useGoals(unitId, objectiveId)

  const objective = plan?.objectives.find((o) => o.id === objectiveId)
  const isLoading = planUnitLoading || planLoading || goalsLoading || !unitId

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="h-6 w-48 bg-gs/60 rounded animate-pulse" />
        <div className="h-32 bg-gs/40 rounded-2xl animate-pulse" />
        <div className="h-48 bg-gs/40 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!plan || !objective) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center">
        <i className="ti ti-mood-confuzed text-5xl text-gs/40 mb-3" aria-hidden="true" />
        <p className="text-base font-semibold text-gd">Objetivo não encontrado</p>
        <p className="text-sm text-gx mt-1">
          O objetivo solicitado não existe ou foi removido.
        </p>
        <Link href="/processos" className="inline-block mt-4 text-sm text-gm hover:text-gd font-medium">
          ← Voltar para Planos
        </Link>
      </div>
    )
  }

  const objectiveTraffic = objective.trafficLight as TrafficLightStatus

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-gx" aria-label="Trilha">
        <Link href="/processos" className="hover:text-gd">
          Planos
        </Link>
        <span>/</span>
        <Link href="/processos" className="hover:text-gd truncate max-w-[200px]">
          {plan.name}
        </Link>
        <span>/</span>
        <span className="text-gd font-medium truncate">Objetivo</span>
      </nav>

      {/* Objective header */}
      <header className="bg-white rounded-2xl border border-gs/60 px-5 py-4">
        <div className="flex items-start gap-3">
          <TrafficLight status={objectiveTraffic} size="md" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gd font-sora">{objective.title}</h1>
            {objective.description && (
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">{objective.description}</p>
            )}
            {objective.benefits && (
              <div className="mt-3 bg-gn/10 border border-gn/30 rounded-lg px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-gd font-semibold mb-0.5">
                  Ganhos e benefícios
                </p>
                <p className="text-xs text-gray-700 leading-relaxed">{objective.benefits}</p>
              </div>
            )}
          </div>
          <div className="w-28 shrink-0 pt-1">
            <ProgressBar value={Number(objective.progressPct)} showLabel size="sm" />
          </div>
        </div>
      </header>

      {/* Goals list */}
      <section className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gs/60">
          <h2 className="text-sm font-semibold text-gray-700 font-sora">
            Metas ({goals.length})
          </h2>
        </div>

        {goals.length === 0 && (
          <p className="text-xs text-gx px-5 py-6 text-center">
            Nenhuma meta cadastrada para este objetivo.
          </p>
        )}

        <div className="divide-y divide-gs/40">
          {goals.map((goal) => {
            const traffic = (Number(goal.progressPct) >= 70
              ? TL.GREEN
              : Number(goal.progressPct) >= 40
                ? TL.YELLOW
                : TL.RED) as TrafficLightStatus
            return (
              <div key={goal.id} className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <TrafficLight status={traffic} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{goal.title}</p>
                    {goal.description && (
                      <p className="text-xs text-gx mt-0.5 line-clamp-2">{goal.description}</p>
                    )}
                  </div>
                  <div className="w-28 hidden sm:block shrink-0">
                    <ProgressBar value={Number(goal.progressPct)} showLabel size="sm" />
                  </div>
                  <Link
                    href={`/processos/${planId}/${objectiveId}/${goal.id}`}
                    className="text-xs text-gm hover:text-gd font-medium shrink-0 whitespace-nowrap"
                    aria-label={`Ver etapas de ${goal.title}`}
                  >
                    Etapas →
                  </Link>
                </div>

                {goal.phases.length > 0 && (
                  <div className="mt-3 ml-6 flex items-center gap-0">
                    {goal.phases.map((phase, i) => {
                      const cfg = PHASE_CFG[phase.status as PhaseStatus]
                      return (
                        <div key={phase.id} className="flex items-center">
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className={clsx(
                                'w-7 h-7 rounded-full flex items-center justify-center text-xs',
                                cfg.bg,
                                cfg.text,
                              )}
                              title={`${phase.order}. ${phase.title} — ${cfg.label}`}
                            >
                              <i className={`ti ${cfg.icon} text-[11px]`} aria-hidden="true" />
                            </div>
                            <span className="text-[10px] text-gx max-w-[70px] text-center leading-tight truncate">
                              {phase.title}
                            </span>
                          </div>
                          {i < goal.phases.length - 1 && <div className="w-6 h-0.5 bg-gs mb-4" />}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
