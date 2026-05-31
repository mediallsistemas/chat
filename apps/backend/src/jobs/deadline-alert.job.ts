import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { EventBusService, NotifyUserRequested } from '../shared/events'
import { NotificationType } from '@mediall/types'

/**
 * Alerts responsible users about tasks due within the next 48h.
 * Runs daily at 07:00 (spec: CLAUDE.md jobs table — `deadline-alert`).
 */
@Injectable()
export class DeadlineAlertJob {
  private readonly logger = new Logger(DeadlineAlertJob.name)

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  @Cron('0 7 * * *')
  async alertUpcomingDeadlines() {
    this.logger.log('Deadline alert job started')
    try {
      const now = new Date()
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)

      const dueTasks = await this.prisma.task.findMany({
        where: {
          completedAt: null,
          isBlocked: false,
          dueDate: { gte: now, lte: in48h },
        },
        select: {
          id: true,
          title: true,
          unitId: true,
          dueDate: true,
          responsibleUserId: true,
        },
        take: 500,
      })

      for (const task of dueTasks) {
        if (!task.responsibleUserId) continue
        this.eventBus.publish(
          new NotifyUserRequested({
            userId: task.responsibleUserId,
            unitId: task.unitId,
            type: NotificationType.TASK_DUE_SOON as any,
            title: 'Prazo se aproximando',
            body: `A tarefa "${task.title}" vence em menos de 48h.`,
            entityType: 'task',
            entityId: task.id,
          }),
        )
      }

      this.logger.log(`Deadline alert job completed — ${dueTasks.length} tasks notified`)
    } catch (err) {
      this.logger.error('Deadline alert job failed', (err as Error).stack)
    }
  }
}
