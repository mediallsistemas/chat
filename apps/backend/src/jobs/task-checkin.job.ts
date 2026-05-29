import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { EventBusService, NotifyUserRequested } from '../shared/events'
import { NotificationType } from '@mediall/types'

@Injectable()
export class TaskCheckinJob {
  private readonly logger = new Logger(TaskCheckinJob.name)

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  @Cron('0 9 * * *')
  async requestCheckins() {
    this.logger.log('Task check-in job started')
    try {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

      const staleTasks = await this.prisma.task.findMany({
        where: {
          completedAt: null,
          isBlocked: false,
          updatedAt: { lte: threeDaysAgo },
        },
        select: {
          id: true,
          title: true,
          unitId: true,
          responsibleUserId: true,
          board: { select: { id: true } },
        },
        take: 200,
      })

      for (const task of staleTasks) {
        if (!task.responsibleUserId) continue
        this.eventBus.publish(
          new NotifyUserRequested({
            userId: task.responsibleUserId,
            unitId: task.unitId,
            type: NotificationType.CHECKIN_REQUEST as any,
            title: 'Atualização de tarefa necessária',
            body: `A tarefa "${task.title}" não recebe atualizações há mais de 3 dias. Qual é o status atual?`,
            entityType: 'task',
            entityId: task.id,
          }),
        )
      }

      this.logger.log(`Task check-in job completed — ${staleTasks.length} tasks notified`)
    } catch (err) {
      this.logger.error('Task check-in job failed', (err as Error).stack)
    }
  }
}
