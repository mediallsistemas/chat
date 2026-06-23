import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { GroupSystemEventService } from '../groups/group-system-event.service'

/**
 * Bridges kanban/strategic domain events into ephemeral system notices shown in
 * the relevant chat group — the "objective/project feed" (Integração 1).
 *
 * Lives in the chat context and only reads the *payloads* of other contexts'
 * events, never their services or event classes (architecture.md §1/§3). The
 * payloads below are typed structurally for the same reason: importing the event
 * class from `contexts/kanban` or `contexts/strategic` would cross a context
 * boundary. Best-effort: a task/objective with no chat group is a silent no-op.
 *
 * Targeting:
 *  - `task.completed` → the chat group that owns the task's Kanban board.
 *  - `phase.*`        → chat groups linked to the phase's objective
 *                       (`Group.objectiveId`), resolved via goal → objective.
 *
 * Only high-signal facts are posted (task *completed*, phase completed/unlocked)
 * to avoid turning the group into a firehose (plano 22 — "Ruído no chat").
 */
interface TaskCompletedPayload {
  taskId: string
  taskTitle: string
  unitId: string
  boardId: string
}

interface PhasePayload {
  phaseId: string
  phaseTitle: string
  goalId: string
  unitId: string
}

@Injectable()
export class StrategyToChatHandler {
  constructor(private system: GroupSystemEventService) {}

  @OnEvent('task.completed')
  async onTaskCompleted(e: TaskCompletedPayload) {
    await this.system.emitForBoard(e.boardId, e.unitId, {
      tone: 'success',
      icon: 'circle-check',
      text: `Tarefa "${e.taskTitle}" concluída.`,
    })
  }

  @OnEvent('phase.completed')
  async onPhaseCompleted(e: PhasePayload) {
    await this.system.emitForGoal(e.goalId, e.unitId, {
      tone: 'success',
      icon: 'flag-check',
      text: `Fase "${e.phaseTitle}" concluída.`,
      href: '/processos',
    })
  }

  @OnEvent('phase.unlocked')
  async onPhaseUnlocked(e: PhasePayload) {
    await this.system.emitForGoal(e.goalId, e.unitId, {
      tone: 'info',
      icon: 'lock-open',
      text: `Fase "${e.phaseTitle}" foi desbloqueada.`,
      href: '/processos',
    })
  }
}
