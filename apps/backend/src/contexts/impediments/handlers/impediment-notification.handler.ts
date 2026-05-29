import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { EventBusService, NotifyUserRequested } from '../../../shared/events'
import { NotificationType } from '@mediall/types'
import { ImpedimentCreatedEvent } from '../events/impediment-created.event'
import { ImpedimentEscalatedEvent } from '../events/impediment-escalated.event'

@Injectable()
export class ImpedimentNotificationHandler {
  constructor(private eventBus: EventBusService) {}

  @OnEvent('impediment.created')
  onCreated(event: ImpedimentCreatedEvent) {
    this.eventBus.publish(
      new NotifyUserRequested({
        userId: event.responsibleUserId,
        unitId: event.unitId,
        type: NotificationType.IMPEDIMENT_CREATED as any,
        title: 'Novo impedimento registrado',
        body: `A tarefa "${event.taskTitle}" tem um novo impedimento que requer sua atenção.`,
        entityType: 'impediment',
        entityId: event.impedimentId,
      }),
    )
  }

  @OnEvent('impediment.escalated')
  onEscalated(event: ImpedimentEscalatedEvent) {
    if (!event.responsibleUserId) return
    this.eventBus.publish(
      new NotifyUserRequested({
        userId: event.responsibleUserId,
        unitId: event.unitId,
        type: NotificationType.IMPEDIMENT_CREATED as any,
        title: `Impedimento escalado (nível ${event.escalationLevel})`,
        body: `Um impedimento sem resolução foi escalado para o nível ${event.escalationLevel}.`,
        entityType: 'impediment',
        entityId: event.impedimentId,
      }),
    )
  }
}
