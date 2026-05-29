import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { EventBusService, NotifyUserRequested } from '../../../../shared/events'
import { NotificationType } from '@mediall/types'
import { PhaseCompletedEvent } from '../events/phase-completed.event'
import { PhaseUnlockedEvent } from '../events/phase-unlocked.event'

@Injectable()
export class PhaseNotificationHandler {
  constructor(private eventBus: EventBusService) {}

  @OnEvent('phase.completed')
  onCompleted(event: PhaseCompletedEvent) {
    if (!event.responsibleUserId) return

    this.eventBus.publish(
      new NotifyUserRequested({
        userId: event.responsibleUserId,
        title: 'Etapa concluída',
        body: `A etapa "${event.phaseTitle}" foi concluída.`,
        type: NotificationType.PHASE_COMPLETED as any,
        entityType: 'phase',
        entityId: event.phaseId,
        unitId: event.unitId,
      }),
    )
  }

  @OnEvent('phase.unlocked')
  onUnlocked(event: PhaseUnlockedEvent) {
    if (!event.responsibleUserId) return

    this.eventBus.publish(
      new NotifyUserRequested({
        userId: event.responsibleUserId,
        title: 'Nova etapa desbloqueada',
        body: `A etapa "${event.phaseTitle}" está disponível para início.`,
        type: NotificationType.PHASE_UNLOCKED as any,
        entityType: 'phase',
        entityId: event.phaseId,
        unitId: event.unitId,
      }),
    )
  }
}
