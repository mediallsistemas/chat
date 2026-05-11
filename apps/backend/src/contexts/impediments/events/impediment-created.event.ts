import { DomainEvent } from '../../shared/events'

export class ImpedimentCreatedEvent extends DomainEvent {
  readonly eventName = 'impediment.created'

  constructor(
    public readonly impedimentId: string,
    public readonly taskId: string,
    public readonly taskTitle: string,
    public readonly unitId: string,
    public readonly responsibleUserId: string,
  ) {
    super()
  }
}
