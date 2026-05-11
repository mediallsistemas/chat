import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { EventBusService } from '../shared/events'
import { ExecutiveReportReadyEvent } from './events/executive-report-ready.event'
import { ImpedimentStatus, UserRole } from '@mediall/types'

@Injectable()
export class ExecutiveReportJob {
  private readonly logger = new Logger(ExecutiveReportJob.name)

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  // Runs every Monday at 07:00
  @Cron('0 7 * * 1')
  async sendWeeklyReport() {
    this.logger.log('Executive report job started')
    try {
      const executives = await this.prisma.user.findMany({
        where: {
          isActive: true,
          unitAccess: { some: { role: { in: [UserRole.SUPER_ADMIN, UserRole.DIRETORIA] } } },
        },
        select: { id: true, name: true, email: true },
      })

      if (executives.length === 0) return

      const [activePlans, openImpediments, blockedTasks, completedThisWeek] = await Promise.all([
        this.prisma.strategicPlan.count({ where: { status: 'ACTIVE' } }),
        this.prisma.taskImpediment.count({ where: { status: { not: ImpedimentStatus.RESOLVED } } }),
        this.prisma.task.count({ where: { isBlocked: true } }),
        this.prisma.task.count({
          where: {
            completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
      ])

      this.eventBus.publish(
        new ExecutiveReportReadyEvent(
          executives.map((e) => ({ userId: e.id, email: e.email, name: e.name })),
          { activePlans, openImpediments, blockedTasks, completedThisWeek },
        ),
      )

      this.logger.log(`Executive report event published for ${executives.length} recipients`)
    } catch (err) {
      this.logger.error('Executive report job failed', (err as Error).stack)
    }
  }
}
