'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { usePlans, useGoals, useCompletePhase, useMacroTasks } from '@/hooks/use-strategic'
import { useUnitStore } from '@/store/unit-store'
import { KanbanBoard, KanbanBoardSkeleton } from '@/components/kanban'
import { Button, ProgressBar } from '@/components/ui'
import { EditPhaseModal, CreateMacroTaskModal, CreatePhaseModal } from '@/components/strategic'
import { PhaseStatus, TaskStatus } from '@mediall/types'
import type { GoalWithPhases } from '@/hooks/use-strategic'
import type { MacroTask } from '@mediall/types'

// ─── Phase timeline ───────────────────────────────────────────────────────────

const PHASE_CFG: Record<PhaseStatus, { label: string; icon: string; ring: string; bg: string; text: string; connector: string }> = {
  ARCHIVED: { label: 'Concluída',     icon: 'ti-check',       ring: 'border-transparent', bg: 'bg-gd',    text: 'text-white', connector: 'bg-gd' },
  ACTIVE:   { label: 'Em andamento',  icon: 'ti-player-play', ring: 'border-gn',          bg: 'bg-gn',    text: 'text-gd',    connector: 'bg-gs' },
  LOCKED:   { label: 'Bloqueada',     icon: 'ti-lock',        ring: 'border-gs',          bg: 'bg-white', text: 'text-gx',    connector: 'bg-gs' },
}

type PhaseSummary = GoalWithPhases['phases'][number]

function PhaseTimeline({
  phases,
  selectedId,
  onSelect,
  onComplete,
  completing,
  unitId,
  goalId,
}: {
  phases: PhaseSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  onComplete: (id: string) => void
  completing: boolean
  unitId: string
  goalId: string
}) {
  const [editingPhase, setEditingPhase] = useState<PhaseSummary | null>(null)
  const [addPhaseOpen, setAddPhaseOpen] = useState(false)
  const activePhase = phases.find((p) => p.status === PhaseStatus.ACTIVE)

  return (
    <div className="bg-white rounded-2xl border border-gs/60 px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 font-sora">Etapas</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setAddPhaseOpen(true)}>
            <i className="ti ti-plus text-sm" aria-hidden="true" />
            Nova etapa
          </Button>
          {activePhase && (
            <Button size="sm" variant="secondary" loading={completing} onClick={() => onComplete(activePhase.id)}>
              <i className="ti ti-check text-sm" aria-hidden="true" />
              Concluir etapa ativa
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-start overflow-x-auto pb-1">
        {phases.map((phase, i) => {
          const cfg = PHASE_CFG[phase.status as PhaseStatus]
          const isSelected = (selectedId ?? activePhase?.id) === phase.id
          const isClickable = phase.status !== PhaseStatus.LOCKED

          return (
            <div key={phase.id} className="flex items-center">
              <button
                onClick={() => isClickable && onSelect(phase.id)}
                disabled={!isClickable}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div
                  className={clsx(
                    'w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm transition-all',
                    cfg.bg, cfg.text, cfg.ring,
                    isSelected && 'ring-2 ring-gn ring-offset-2',
                    isClickable ? 'cursor-pointer group-hover:scale-110' : 'cursor-default opacity-60',
                  )}
                  title={`${phase.order}. ${phase.title} — ${cfg.label}`}
                >
                  <i className={`ti ${cfg.icon} text-xs`} aria-hidden="true" />
                </div>
                <span className="text-[11px] text-gx max-w-[72px] text-center leading-tight">
                  {phase.title}
                </span>
                {phase.status === PhaseStatus.ACTIVE && (
                  <span className="text-[9px] font-semibold text-gd bg-gn/60 px-1.5 rounded-full">
                    Ativa
                  </span>
                )}
                {phase.status !== PhaseStatus.LOCKED && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingPhase(phase) }}
                    className="text-[10px] text-gx hover:text-gd transition-colors"
                    aria-label={`Editar etapa ${phase.title}`}
                  >
                    <i className="ti ti-pencil" aria-hidden="true" />
                  </button>
                )}
              </button>
              {i < phases.length - 1 && (
                <div className={clsx('w-10 h-0.5 mb-6 mx-1', cfg.connector)} />
              )}
            </div>
          )
        })}
      </div>

      {editingPhase && (
        <EditPhaseModal
          open={!!editingPhase}
          onClose={() => setEditingPhase(null)}
          unitId={unitId}
          goalId={goalId}
          phase={editingPhase}
        />
      )}

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

// ─── Macro Task status label ──────────────────────────────────────────────────

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: 'Não iniciada',
  IN_PROGRESS: 'Em andamento',
  BLOCKED: 'Impedida',
  REVIEW: 'Em revisão',
  DONE: 'Concluída',
}

const TASK_STATUS_CLASS: Record<TaskStatus, string> = {
  NOT_STARTED: 'bg-gs text-gx',
  IN_PROGRESS: 'bg-gn text-gd',
  BLOCKED: 'bg-red-100 text-red-600',
  REVIEW: 'bg-yellow-100 text-yellow-700',
  DONE: 'bg-gd text-white',
}

// ─── Macro Tasks section ──────────────────────────────────────────────────────

function MacroTasksSection({
  unitId,
  phaseId,
  phaseStatus,
}: {
  unitId: string
  phaseId: string
  phaseStatus: PhaseStatus
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const { data: macroTasks, isLoading } = useMacroTasks(unitId, phaseId)

  if (phaseStatus === PhaseStatus.LOCKED) return null

  return (
    <div className="bg-white rounded-2xl border border-gs/60 px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 font-sora">Macrotarefas</h3>
        <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
          <i className="ti ti-plus text-sm" aria-hidden="true" />
          Nova macrotarefa
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="h-4 w-4 rounded-full bg-gs animate-pulse shrink-0" />
              <div className="flex-1 h-4 rounded bg-gs animate-pulse" />
              <div className="h-5 w-20 rounded-full bg-gs animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && macroTasks?.length === 0 && (
        <p className="text-sm text-gx text-center py-4">Nenhuma macrotarefa cadastrada.</p>
      )}

      {!isLoading && macroTasks && macroTasks.length > 0 && (
        <div className="divide-y divide-gs/40">
          {macroTasks.map((mt) => (
            <MacroTaskRow key={mt.id} macroTask={mt} />
          ))}
        </div>
      )}

      <CreateMacroTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        unitId={unitId}
        phaseId={phaseId}
      />
    </div>
  )
}

function MacroTaskRow({ macroTask }: { macroTask: MacroTask }) {
  const status = macroTask.status as TaskStatus
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{macroTask.title}</p>
        {macroTask.dueDate && (
          <p className="text-[11px] text-gx mt-0.5">
            Prazo: {new Date(macroTask.dueDate).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-medium', TASK_STATUS_CLASS[status])}>
          {TASK_STATUS_LABEL[status]}
        </span>
        <div className="w-16">
          <ProgressBar value={Number(macroTask.progressPct)} size="sm" />
        </div>
        <Link
          href={`/kanban/${macroTask.kanbanBoardId}`}
          className="text-xs text-gm hover:text-gd font-medium whitespace-nowrap"
          aria-label={`Abrir kanban de ${macroTask.title}`}
        >
          Kanban →
        </Link>
      </div>
    </div>
  )
}

// ─── Kanban section ───────────────────────────────────────────────────────────

function PhaseKanban({ phase }: { phase: PhaseSummary }) {
  if (phase.status === PhaseStatus.LOCKED) {
    return (
      <div className="bg-white rounded-2xl border border-gs/60 px-5 py-10 text-center text-gx text-sm">
        <i className="ti ti-lock text-2xl mb-2 block" aria-hidden="true" />
        Etapa bloqueada. Conclua a etapa anterior para desbloqueá-la.
      </div>
    )
  }

  if (!phase.kanbanBoardId) {
    return (
      <div className="bg-white rounded-2xl border border-gs/60 px-5 py-10 text-center text-gx text-sm">
        Kanban não disponível para esta etapa.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gs/60 px-5 py-4">
      <KanbanBoard boardId={phase.kanbanBoardId} boardName={phase.title} />
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

interface Props {
  planId: string
  objectiveId: string
  goalId: string
}

export function GoalDetailView({ planId, objectiveId, goalId }: Props) {
  const { activeUnit } = useUnitStore()
  const unitId = activeUnit?.id ?? ''

  const { data: goals, isLoading } = useGoals(unitId || undefined, objectiveId)
  const { data: plans } = usePlans(unitId || undefined)
  const { mutate: completePhase, isPending: completing } = useCompletePhase(unitId, goalId)

  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null)
  const [firstPhaseOpen, setFirstPhaseOpen] = useState(false)

  const goal = goals?.find((g) => g.id === goalId)
  const plan = plans?.find((p) => p.id === planId)
  const phases = goal?.phases ?? []
  const activePhase = phases.find((p) => p.status === PhaseStatus.ACTIVE)
  const displayPhase = phases.find((p) => p.id === (selectedPhaseId ?? activePhase?.id)) ?? null

  if (!unitId) {
    return (
      <div className="flex items-center justify-center h-40 text-gx text-sm">
        Selecione uma unidade.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gx" aria-label="Navegação">
        <Link href="/processos" className="hover:text-gd transition-colors">
          Planos
        </Link>
        {plan && (
          <>
            <i className="ti ti-chevron-right text-[10px]" aria-hidden="true" />
            <Link href="/processos" className="hover:text-gd transition-colors truncate max-w-[160px]">
              {plan.name}
            </Link>
          </>
        )}
        {goal && (
          <>
            <i className="ti ti-chevron-right text-[10px]" aria-hidden="true" />
            <span className="text-gray-700 font-medium truncate max-w-[220px]">{goal.title}</span>
          </>
        )}
      </nav>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gs/60 px-5 py-4 space-y-3">
            <div className="h-5 w-56 rounded bg-gs animate-pulse" />
            <div className="h-3 w-32 rounded bg-gs animate-pulse" />
          </div>
          <div className="bg-white rounded-2xl border border-gs/60 px-5 py-4 space-y-3">
            <div className="h-4 w-24 rounded bg-gs animate-pulse" />
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="w-9 h-9 rounded-full bg-gs animate-pulse" />
                  <div className="h-3 w-14 rounded bg-gs animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          <KanbanBoardSkeleton />
        </div>
      )}

      {/* Content */}
      {!isLoading && goal && (
        <>
          {/* Goal header */}
          <div className="bg-white rounded-2xl border border-gs/60 px-5 py-4">
            <h2 className="text-base font-bold text-gray-900 font-sora">{goal.title}</h2>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 max-w-xs">
                <ProgressBar value={Number(goal.progressPct)} showLabel color="brand" />
              </div>
              <span className="text-xs text-gx">
                {phases.length} {phases.length === 1 ? 'etapa' : 'etapas'}
              </span>
            </div>
          </div>

          {/* Phase timeline */}
          {phases.length > 0 ? (
            <PhaseTimeline
              phases={phases}
              selectedId={selectedPhaseId}
              onSelect={setSelectedPhaseId}
              onComplete={completePhase}
              completing={completing}
              unitId={unitId}
              goalId={goalId}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-gs/60 px-5 py-8 text-center text-gx text-sm space-y-3">
              <p>Nenhuma etapa cadastrada para esta meta.</p>
              <Button size="sm" variant="ghost" onClick={() => setFirstPhaseOpen(true)}>
                <i className="ti ti-plus text-sm" aria-hidden="true" />
                Adicionar primeira etapa
              </Button>
              <CreatePhaseModal
                open={firstPhaseOpen}
                onClose={() => setFirstPhaseOpen(false)}
                unitId={unitId}
                goalId={goalId}
                nextOrder={1}
              />
            </div>
          )}

          {/* Macro tasks of selected/active phase */}
          {displayPhase && (
            <MacroTasksSection
              unitId={unitId}
              phaseId={displayPhase.id}
              phaseStatus={displayPhase.status as PhaseStatus}
            />
          )}

          {/* Kanban of selected/active phase */}
          {displayPhase && <PhaseKanban phase={displayPhase} />}
        </>
      )}

      {!isLoading && !goal && (
        <div className="bg-white rounded-2xl border border-gs/60 px-5 py-10 text-center text-gx text-sm">
          Meta não encontrada.
        </div>
      )}
    </div>
  )
}
