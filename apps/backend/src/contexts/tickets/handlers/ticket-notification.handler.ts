import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { EventBusService, NotifyUserRequested } from '../../../shared/events'
import { NotificationType } from '@mediall/types'
import { TicketAssignedEvent } from '../events/ticket-assigned.event'
import { TicketStatusChangedEvent } from '../events/ticket-status-changed.event'

@Injectable()
export class TicketNotificationHandler {
  constructor(private eventBus: EventBusService) {}

  @OnEvent('ticket.assigned')
  onAssigned(event: TicketAssignedEvent) {
    this.eventBus.publish(
      new NotifyUserRequested({
        userId: event.assignedToUserId,
        unitId: event.unitId,
        type: NotificationType.TICKET_ASSIGNED as any,
        title: 'Chamado atribuído a você',
        body: `O chamado "${event.ticketTitle}" foi atribuído a você.`,
        entityType: 'ticket',
        entityId: event.ticketId,
      }),
    )
  }

  @OnEvent('ticket.status_changed')
  onStatusChanged(event: TicketStatusChangedEvent) {
    this.eventBus.publish(
      new NotifyUserRequested({
        userId: event.reportedByUserId,
        unitId: event.unitId,
        type: NotificationType.TICKET_UPDATED as any,
        title: 'Chamado atualizado',
        body: `O chamado "${event.ticketTitle}" mudou para "${event.newStatus}".`,
        entityType: 'ticket',
        entityId: event.ticketId,
      }),
    )
  }
}
