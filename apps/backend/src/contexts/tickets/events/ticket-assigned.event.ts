import { DomainEvent } from '../../shared/events'

export class TicketAssignedEvent extends DomainEvent {
  readonly eventName = 'ticket.assigned'

  constructor(
    public readonly ticketId: string,
    public readonly ticketTitle: string,
    public readonly unitId: string,
    public readonly assignedToUserId: string,
  ) {
    super()
  }
}
