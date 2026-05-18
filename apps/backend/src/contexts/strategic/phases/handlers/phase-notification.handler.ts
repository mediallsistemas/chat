import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { NotificationsService } from '../../../../infrastructure/notifications/notifications.service'
import { NotificationType } from '@mediall/types'
import { PhaseCompletedEvent } from '../events/phase-completed.event'
import { PhaseUnlockedEvent } from '../events/phase-unlocked.event'

@Injectable()
export class PhaseNotificationHandler {
  constructor(private notifications: NotificationsService) {}

  @OnEvent('phase.completed')
  async onCompleted(event: PhaseCompletedEvent) {
    if (!event.responsibleUserId) return

    await this.notifications.create({
      userId: event.responsibleUserId,
      title: 'Etapa concluída',
      body: `A etapa "${event.phaseTitle}" foi concluída.`,
      type: NotificationType.PHASE_COMPLETED,
      entityType: 'phase',
      entityId: event.phaseId,
      unitId: event.unitId,
    })
  }

  @OnEvent('phase.unlocked')
  async onUnlocked(event: PhaseUnlockedEvent) {
    if (!event.responsibleUserId) return

    await this.notifications.create({
      userId: event.responsibleUserId,
      title: 'Nova etapa desbloqueada',
      body: `A etapa "${event.phaseTitle}" está disponível para início.`,
      type: NotificationType.PHASE_UNLOCKED,
      entityType: 'phase',
      entityId: event.phaseId,
      unitId: event.unitId,
    })
  }
}
