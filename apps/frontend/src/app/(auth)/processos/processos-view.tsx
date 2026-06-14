'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { ProgressBar, TrafficLight, Button } from '@/shared/components/ui'
import { PlanListSkeleton, ObjectivesSkeleton } from '@/features/strategic/components/plan-list-skeleton'
import type { TrafficLightStatus } from '@/shared/components/ui'
import {
  usePlans,
  useObjectives,
  useGoals,
  type GoalWithPhases,
  type ObjectiveWithGoals,
  type PlanWithObjectiveCount,
} from '@/features/strategic/hooks/use-strategic'
import {
  CreatePlanModal,
  CreateObjectiveModal,
  CreateGoalModal,
  CreatePhaseModal,
  EditPlanModal,
  EditObjectiveModal,
  EditGoalModal,
} from '@/features/strategic/components'
import { useUnitStore } from '@/shared/store/unit-store'
import { PlanStatus, PhaseStatus, TrafficLight as TL } from '@mediall/types'
import type { PlanPhase } from '@mediall/types'

// ─── Phase Timeline ───────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<
  PhaseStatus,
  { label: string; icon: string; bg: string; text: string; connector: string }
> = {
  ARCHIVED: { label: 'Concluída', icon: 'ti-check', bg: 'bg-gd', text: 'text-white', connector: 'bg-gd' },
  ACTIVE: { label: 'Em andamento', icon: 'ti-player-play', bg: 'bg-gn', text: 'text-gd', connector: 'bg-gs' },
  LOCKED: { label: 'Bloqueada', icon: 'ti-lock', bg: 'bg-white', text: 'text-gx', connector: 'bg-gs' },
}

function PhaseTimeline({
  phases,
  unitId,
  goalId,
}: {
  phases: Pick<PlanPhase, 'id' | 'title' | 'status' | 'order'>[]
  unitId: string
  goalId: string
}) {
  const [addPhaseOpen, setAddPhaseOpen] = useState(false)

  return (
    <div className="mt-2 ml-4">
      <div className="flex items-center gap-0">
        {phases.map((phase, i) => {
          const cfg = PHASE_CONFIG[phase.status as PhaseStatus]
          return (
            <div key={phase.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={clsx(
                    'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs',
                    cfg.bg,
                    cfg.text,
                    phase.status === 'LOCKED' ? 'border-gs' : 'border-transparent',
                  )}
                  title={`${phase.order}. ${phase.title} — ${cfg.label}`}
                >
                  <i className={`ti ${cfg.icon} text-[11px]`} aria-hidden="true" />
                </div>
                <span className="text-[10px] text-gx max-w-[60px] text-center leading-tight">
                  {phase.title}
                </span>
              </div>
              {i < phases.length - 1 && (
                <div className={clsx('w-8 h-0.5 mb-4', cfg.connector)} />
              )}
            </div>
          )
        })}

        <button
          onClick={() => setAddPhaseOpen(true)}
          className="ml-3 w-7 h-7 rounded-full border-2 border-dashed border-gs flex items-center justify-center text-gx hover:border-gd hover:text-gd transition-colors mb-4"
          title="Adicionar etapa"
          aria-label="Adicionar etapa"
        >
          <i className="ti ti-plus text-[11px]" aria-hidden="true" />
        </button>
      </div>

      <CreatePhaseModal
        open={addPhaseOpen}
        onClose={() => setAddPhaseOpen(false)}
        unitId={unitId}
        goalId={goalId}
        nextOrder={phases.length + 1}
      />
    </div>
  )
}

// ─── Goal Row ─────────────────────────────────────────────────────────────────

function GoalRow({
  goal,
  unitId,
  planId,
  objectiveId,
}: {
  goal: GoalWithPhases
  unitId: string
  planId: string
  objectiveId: string
}) {
  const [editOpen, setEditOpen] = useState(false)

  const trafficStatus = (goal.progressPct >= 70
    ? TL.GREEN
    : goal.progressPct >= 40
      ? TL.YELLOW
      : TL.RED) as TrafficLightStatus

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <TrafficLight status={trafficStatus} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{goal.title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-24 hidden sm:block">
            <ProgressBar value={Number(goal.progressPct)} showLabel size="sm" />
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="p-1 text-gx hover:text-gd transition-colors"
            aria-label={`Editar meta ${goal.title}`}
          >
            <i className="ti ti-pencil text-sm" aria-hidden="true" />
          </button>
          <Link
            href={`/processos/${planId}/${objectiveId}/${goal.id}`}
            className="text-xs text-gm hover:text-gd font-medium whitespace-nowrap"
            aria-label={`Ver etapas de ${goal.title}`}
          >
            Etapas →
          </Link>
        </div>
      </div>
      {goal.phases.length > 0 && (
        <PhaseTimeline phases={goal.phases} unitId={unitId} goalId={goal.id} />
      )}
      {goal.phases.length === 0 && (
        <div className="mt-1 ml-4">
          <PhaseTimeline phases={[]} unitId={unitId} goalId={goal.id} />
        </div>
      )}

      <EditGoalModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        unitId={unitId}
        objectiveId={objectiveId}
        goal={goal}
      />
    </div>
  )
}

// ─── Objective Accordion ─────────────────────────────────────────────────────

function ObjectiveAccordion({
  objective,
  unitId,
  planId,
}: {
  objective: ObjectiveWithGoals
  unitId: string
  planId: string
}) {
  const [open, setOpen] = useState(true)
  const [addGoalOpen, setAddGoalOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const { data: goals, isLoading } = useGoals(unitId, objective.id, { enabled: open })
  const router = useRouter()

  return (
    <div className="border border-gs/60 rounded-xl overflow-hidden">
      <div className="flex items-center bg-page-bg hover:bg-gs/30 transition-colors">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center justify-between px-4 py-3"
          aria-expanded={open}
        >
          <div className="flex items-center gap-3 min-w-0">
            <i
              className={clsx('ti text-gx text-sm transition-transform', open ? 'ti-chevron-down' : 'ti-chevron-right')}
              aria-hidden="true"
            />
            <span className="text-sm font-semibold text-gray-800 font-sora truncate">{objective.title}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <div className="w-20 hidden sm:block">
              <ProgressBar value={Number(objective.progressPct)} size="sm" />
            </div>
            <span className="text-xs font-semibold text-gx w-9 text-right">
              {Math.round(Number(objective.progressPct))}%
            </span>
          </div>
        </button>
        {objective.groupId && (
          <button
            onClick={() => router.push(`/mensagens?group=${objective.groupId}`)}
            className="px-3 py-3 text-gx hover:text-gd transition-colors"
            aria-label={`Abrir chat do objetivo ${objective.title}`}
            title="Abrir chat do grupo vinculado"
          >
            <i className="ti ti-message-2 text-sm" aria-hidden="true" />
          </button>
        )}
        <button
          onClick={() => setEditOpen(true)}
          className="px-3 py-3 text-gx hover:text-gd transition-colors"
          aria-label={`Editar objetivo ${objective.title}`}
        >
          <i className="ti ti-pencil text-sm" aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="divide-y divide-gs/40">
          {isLoading && (
            <div className="px-4 py-3 space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-full bg-gs animate-pulse shrink-0" />
                  <div className="flex-1 h-4 rounded bg-gs animate-pulse" />
                  <div className="h-2 w-20 rounded-full bg-gs animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {goals?.map((goal) => (
            <GoalRow key={goal.id} goal={goal} unitId={unitId} planId={planId} objectiveId={objective.id} />
          ))}

          {!isLoading && goals?.length === 0 && (
            <div className="px-4 py-3 text-sm text-gx">Nenhuma meta cadastrada.</div>
          )}

          <div className="px-4 py-2">
            <Button variant="ghost" size="sm" onClick={() => setAddGoalOpen(true)}>
              <i className="ti ti-plus text-sm" aria-hidden="true" />
              Adicionar meta
            </Button>
          </div>
        </div>
      )}

      <CreateGoalModal
        open={addGoalOpen}
        onClose={() => setAddGoalOpen(false)}
        unitId={unitId}
        objectiveId={objective.id}
      />

      <EditObjectiveModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        unitId={unitId}
        planId={planId}
        objective={objective}
      />
    </div>
  )
}

// ─── Plan Status Badge ────────────────────────────────────────────────────────

const STATUS_LABEL: Record<PlanStatus, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo',
  ARCHIVED: 'Arquivado',
}

const STATUS_CLASS: Record<PlanStatus, string> = {
  DRAFT: 'bg-gs text-gx',
  ACTIVE: 'bg-gn text-gd',
  ARCHIVED: 'bg-gray-100 text-gray-400',
}

// ─── Plan Sidebar Card ────────────────────────────────────────────────────────

function PlanCard({
  plan,
  selected,
  onClick,
  onEdit,
}: {
  plan: PlanWithObjectiveCount
  selected: boolean
  onClick: () => void
  onEdit: () => void
}) {
  return (
    <div
      className={clsx(
        'w-full text-left rounded-xl border transition-colors group',
        selected ? 'bg-gd text-white border-gd' : 'bg-white text-gray-700 border-gs/60 hover:bg-page-bg',
      )}
    >
      <button onClick={onClick} className="w-full text-left px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold font-sora truncate">{plan.year}</span>
          <span
            className={clsx(
              'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
              selected ? 'bg-white/20 text-white' : STATUS_CLASS[plan.status as PlanStatus],
            )}
          >
            {STATUS_LABEL[plan.status as PlanStatus]}
          </span>
        </div>
        <p className="text-xs leading-snug">{plan.name}</p>
        <p className="text-[10px] mt-1 opacity-70">
          {plan._count.objectives} {plan._count.objectives === 1 ? 'objetivo' : 'objetivos'}
        </p>
      </button>
      <div className="px-2 pb-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className={clsx(
            'p-1 rounded transition-colors text-[11px]',
            selected ? 'text-white/70 hover:text-white' : 'text-gx hover:text-gd',
          )}
          aria-label={`Editar plano ${plan.name}`}
        >
          <i className="ti ti-pencil" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function ProcessosView() {
  const { activeUnit } = useUnitStore()
  const unitId = activeUnit?.id ?? ''

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [newPlanOpen, setNewPlanOpen] = useState(false)
  const [editPlanOpen, setEditPlanOpen] = useState(false)
  const [newObjectiveOpen, setNewObjectiveOpen] = useState(false)

  const { data: plans, isLoading: plansLoading } = usePlans(unitId || undefined)
  const activePlanId = selectedPlanId ?? plans?.[0]?.id ?? null

  const { data: objectives, isLoading: objectivesLoading } = useObjectives(
    unitId || undefined,
    activePlanId ?? undefined,
  )

  const activePlan = plans?.find((p) => p.id === activePlanId)

  if (!unitId) {
    return (
      <div className="flex items-center justify-center h-full text-gx text-sm">
        Selecione uma unidade para ver os planos estratégicos.
      </div>
    )
  }

  return (
    <div className="flex gap-5 h-full">
      {/* Plan list sidebar */}
      <aside className="w-52 shrink-0 flex flex-col gap-2" aria-label="Lista de planos">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gx uppercase tracking-wide">Planos</span>
          <Button size="sm" variant="ghost" aria-label="Novo plano" onClick={() => setNewPlanOpen(true)}>
            <i className="ti ti-plus text-sm" aria-hidden="true" />
          </Button>
        </div>

        {plansLoading && <PlanListSkeleton />}

        {!plansLoading && plans?.length === 0 && (
          <p className="text-xs text-gx text-center py-4">Nenhum plano cadastrado.</p>
        )}

        {plans?.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            selected={p.id === activePlanId}
            onClick={() => setSelectedPlanId(p.id)}
            onEdit={() => { setSelectedPlanId(p.id); setEditPlanOpen(true) }}
          />
        ))}
      </aside>

      {/* Plan detail */}
      <div className="flex-1 min-w-0 space-y-4">
        {!activePlan && !plansLoading && (
          <div className="bg-white rounded-2xl border border-gs/60 px-5 py-10 text-center text-gx text-sm">
            Selecione ou crie um plano estratégico para começar.
          </div>
        )}

        {activePlan && (
          <>
            {/* Plan header */}
            <div className="bg-white rounded-2xl border border-gs/60 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={clsx(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        STATUS_CLASS[activePlan.status as PlanStatus],
                      )}
                    >
                      {STATUS_LABEL[activePlan.status as PlanStatus]}
                    </span>
                    <span className="text-xs text-gx">·</span>
                    <span className="text-xs text-gx">{activePlan.year}</span>
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 font-sora">{activePlan.name}</h2>
                  {activePlan.vision && (
                    <p className="text-xs text-gx mt-1 max-w-lg">{activePlan.vision}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Objectives */}
            <div className="space-y-3">
              {objectivesLoading && <ObjectivesSkeleton />}

              {!objectivesLoading &&
                objectives?.map((obj) => (
                  <ObjectiveAccordion key={obj.id} objective={obj} unitId={unitId} planId={activePlanId!} />
                ))}

              {!objectivesLoading && objectives?.length === 0 && (
                <div className="bg-white rounded-2xl border border-gs/60 px-5 py-8 text-center text-gx text-sm">
                  Nenhum objetivo cadastrado neste plano.
                </div>
              )}
            </div>

            {/* Add objective */}
            <Button variant="ghost" size="sm" onClick={() => setNewObjectiveOpen(true)}>
              <i className="ti ti-plus text-sm" aria-hidden="true" />
              Adicionar objetivo
            </Button>
          </>
        )}
      </div>

      {/* Modals */}
      <CreatePlanModal
        open={newPlanOpen}
        onClose={() => setNewPlanOpen(false)}
        unitId={unitId}
      />

      {activePlan && (
        <EditPlanModal
          open={editPlanOpen}
          onClose={() => setEditPlanOpen(false)}
          unitId={unitId}
          plan={activePlan}
        />
      )}

      {activePlanId && (
        <CreateObjectiveModal
          open={newObjectiveOpen}
          onClose={() => setNewObjectiveOpen(false)}
          unitId={unitId}
          planId={activePlanId}
        />
      )}
    </div>
  )
}
