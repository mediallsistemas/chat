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
   * Emit a notice to the chat group that owns the given task's Kanban board, if
   * one exists. A task's board is owned by a group when `Group.kanbanBoardId`
   * matches the task's `boardId`. No group → no-op (silently skipped).
   */
  async emitForTask(taskId: string, unitId: string, notice: SystemNotice) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, unitId },
      select: { boardId: true },
    })
    if (!task) return

    const group = await this.prisma.group.findFirst({
      where: { kanbanBoardId: task.boardId, unitId, isArchived: false },
      select: { id: true },
    })
    if (!group) return

    this.emitToGroup(group.id, notice)
  }
}
