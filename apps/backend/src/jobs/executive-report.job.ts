import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { MailService } from '../mail/mail.service'
import { ImpedimentStatus, NotificationType, UserRole } from '@mediall/types'

@Injectable()
export class ExecutiveReportJob {
  private readonly logger = new Logger(ExecutiveReportJob.name)

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private mail: MailService,
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

    const title = 'Relatório Executivo Semanal'
    const body = [
      `📊 Resumo da semana:`,
      `• Planos estratégicos ativos: ${activePlans}`,
      `• Impedimentos em aberto: ${openImpediments}`,
      `• Tarefas bloqueadas: ${blockedTasks}`,
      `• Tarefas concluídas na semana: ${completedThisWeek}`,
      ``,
      `Acesse o painel para ver o relatório completo.`,
    ].join('\n')

    for (const exec of executives) {
      await this.notifications.create({
        userId: exec.id,
        type: NotificationType.GOAL_AT_RISK,
        title,
        body,
        entityType: 'report',
        entityId: undefined,
        unitId: undefined,
      })

      this.mail
        .sendNotification({
          to: exec.email,
          name: exec.name,
          type: NotificationType.GOAL_AT_RISK,
          title,
          body,
          actionUrl: '/dashboard',
        })
        .catch((err: Error) => this.logger.error('Executive report email failed', err.stack))
    }
    this.logger.log(`Executive report sent to ${executives.length} users`)
    } catch (err) {
      this.logger.error('Executive report job failed', (err as Error).stack)
    }
  }
}
