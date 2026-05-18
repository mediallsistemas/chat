import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { NotificationsService } from '../../../infrastructure/notifications/notifications.service'
import { NotificationType } from '@mediall/types'
import { TicketAssignedEvent } from '../events/ticket-assigned.event'
import { TicketStatusChangedEvent } from '../events/ticket-status-changed.event'

@Injectable()
export class TicketNotificationHandler {
  constructor(private notifications: NotificationsService) {}

  @OnEvent('ticket.assigned')
  async onAssigned(event: TicketAssignedEvent) {
    await this.notifications
      .create({
        userId: event.assignedToUserId,
        unitId: event.unitId,
        type: NotificationType.TICKET_ASSIGNED,
        title: 'Chamado atribuído a você',
        body: `O chamado "${event.ticketTitle}" foi atribuído a você.`,
        entityType: 'ticket',
        entityId: event.ticketId,
      })
      .catch(() => undefined)
  }

  @OnEvent('ticket.status_changed')
  async onStatusChanged(event: TicketStatusChangedEvent) {
    await this.notifications
      .create({
        userId: event.reportedByUserId,
        unitId: event.unitId,
        type: NotificationType.TICKET_UPDATED,
        title: 'Chamado atualizado',
        body: `O chamado "${event.ticketTitle}" mudou para "${event.newStatus}".`,
        entityType: 'ticket',
        entityId: event.ticketId,
      })
      .catch(() => undefined)
  }
}
