import { DomainEvent } from '../../shared/events'

export class ImpedimentEscalatedEvent extends DomainEvent {
  readonly eventName = 'impediment.escalated'

  constructor(
    public readonly impedimentId: string,
    public readonly taskId: string,
    public readonly unitId: string,
    public readonly escalationLevel: number,
    public readonly responsibleUserId: string | null,
  ) {
    super()
  }
}
