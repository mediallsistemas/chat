import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { NotificationsService } from '../../notifications/notifications.service'
import { NotificationType } from '@mediall/types'
import { ImpedimentCreatedEvent } from '../events/impediment-created.event'
import { ImpedimentEscalatedEvent } from '../events/impediment-escalated.event'

@Injectable()
export class ImpedimentNotificationHandler {
  constructor(private notifications: NotificationsService) {}

  @OnEvent('impediment.created')
  async onCreated(event: ImpedimentCreatedEvent) {
    await this.notifications
      .create({
        userId: event.responsibleUserId,
        unitId: event.unitId,
        type: NotificationType.IMPEDIMENT_CREATED,
        title: 'Novo impedimento registrado',
        body: `A tarefa "${event.taskTitle}" tem um novo impedimento que requer sua atenção.`,
        entityType: 'impediment',
        entityId: event.impedimentId,
      })
      .catch(() => undefined)
  }

  @OnEvent('impediment.escalated')
  async onEscalated(event: ImpedimentEscalatedEvent) {
    if (!event.responsibleUserId) return
    await this.notifications
      .create({
        userId: event.responsibleUserId,
        unitId: event.unitId,
        type: NotificationType.IMPEDIMENT_CREATED,
        title: `Impedimento escalado (nível ${event.escalationLevel})`,
        body: `Um impedimento sem resolução foi escalado para o nível ${event.escalationLevel}.`,
        entityType: 'impediment',
        entityId: event.impedimentId,
      })
      .catch(() => undefined)
  }
}
