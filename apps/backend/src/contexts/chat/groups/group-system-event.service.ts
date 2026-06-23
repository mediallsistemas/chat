import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { EventBusService } from '../../../shared/events'
import { GroupSystemEvent } from './events/group-system-event.event'

type SystemNotice = GroupSystemEvent['payload']

/**
 * Emits ephemeral "system events" into chat groups in reaction to domain events
 * from other contexts (impediments, strategy, meetings). Nothing is persisted —
 * the realtime bridge forwards each notice to the group's socket room.
 *
 * Lives in the chat context and only consumes other contexts' event payloads,
 * never their services (architecture.md §1/§3).
 */
@Injectable()
export class GroupSystemEventService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  /** Emit a notice to an explicit group. */
  emitToGroup(groupId: string, notice: SystemNotice) {
    this.eventBus.publish(new GroupSystemEvent(groupId, notice))
  }

  /**
   * Emit a notice to the chat group that owns the given Kanban board, if one
   * exists. A board is owned by a group when `Group.kanbanBoardId` matches.
   * No group → no-op (silently skipped).
   */
  async emitForBoard(boardId: string, unitId: string, notice: SystemNotice) {
    const group = await this.prisma.group.findFirst({
      where: { kanbanBoardId: boardId, unitId, isArchived: false },
      select: { id: true },
    })
    if (!group) return

    this.emitToGroup(group.id, notice)
  }

  /**
   * Emit a notice to the chat group that owns the given task's Kanban board, if
   * one exists. No task / no owning group → no-op.
   */
  async emitForTask(taskId: string, unitId: string, notice: SystemNotice) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, unitId },
      select: { boardId: true },
    })
    if (!task) return

    await this.emitForBoard(task.boardId, unitId, notice)
  }

  /**
   * Emit a notice to every non-archived chat group linked to an objective
   * (`Group.objectiveId`). Used for the "objective/project feed" so PROJECT
   * groups surface phase progress of the objective they track. No linked group
   * → no-op.
   */
  async emitForObjective(objectiveId: string, unitId: string, notice: SystemNotice) {
    const groups = await this.prisma.group.findMany({
      where: { objectiveId, unitId, isArchived: false },
      select: { id: true },
    })
    for (const g of groups) this.emitToGroup(g.id, notice)
  }

  /**
   * Resolve a goal to its parent objective and emit to that objective's groups.
   * Phase events carry `goalId`; the group link lives on the objective, so we
   * walk goal → objective first. No goal → no-op.
   */
  async emitForGoal(goalId: string, unitId: string, notice: SystemNotice) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, unitId },
      select: { objectiveId: true },
    })
    if (!goal) return

    await this.emitForObjective(goal.objectiveId, unitId, notice)
  }

  /**
   * Emit a notice to the chat group a meeting belongs to (`Meeting.groupId`),
   * if any. Meetings created outside a group → no-op.
   */
  async emitForMeeting(meetingId: string, unitId: string, notice: SystemNotice) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, unitId },
      select: { groupId: true },
    })
    if (!meeting?.groupId) return

    this.emitToGroup(meeting.groupId, notice)
  }
}
