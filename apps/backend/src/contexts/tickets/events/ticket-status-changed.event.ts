import { DomainEvent } from '../../../shared/events'

export class TicketStatusChangedEvent extends DomainEvent {
  readonly eventName = 'ticket.status_changed'

  constructor(
    public readonly ticketId: string,
    public readonly ticketTitle: string,
    public readonly unitId: string,
    public readonly reportedByUserId: string,
    public readonly newStatus: string,
  ) {
    super()
  }
}
