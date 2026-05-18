import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { NotificationsService } from '../../infrastructure/notifications/notifications.service'
import { MailService } from '../../infrastructure/mail/mail.service'
import { NotificationType } from '@mediall/types'
import { ExecutiveReportReadyEvent } from '../events/executive-report-ready.event'

@Injectable()
export class ExecutiveReportHandler {
  private readonly logger = new Logger(ExecutiveReportHandler.name)

  constructor(
    private notifications: NotificationsService,
    private mail: MailService,
  ) {}

  @OnEvent('report.executive_ready')
  async handle(event: ExecutiveReportReadyEvent) {
    const { report } = event

    const title = 'Relatório Executivo Semanal'
    const body = [
      `📊 Resumo da semana:`,
      `• Planos estratégicos ativos: ${report.activePlans}`,
      `• Impedimentos em aberto: ${report.openImpediments}`,
      `• Tarefas bloqueadas: ${report.blockedTasks}`,
      `• Tarefas concluídas na semana: ${report.completedThisWeek}`,
      ``,
      `Acesse o painel para ver o relatório completo.`,
    ].join('\n')

    for (const recipient of event.recipientIds) {
      await this.notifications.create({
        userId: recipient.userId,
        type: NotificationType.GOAL_AT_RISK,
        title,
        body,
        entityType: 'report',
        entityId: undefined,
        unitId: undefined,
      })

      this.mail
        .sendNotification({
          to: recipient.email,
          name: recipient.name,
          type: NotificationType.GOAL_AT_RISK,
          title,
          body,
          actionUrl: '/dashboard',
        })
        .catch((err: Error) => this.logger.error('Executive report email failed', err.stack))
    }
  }
}
