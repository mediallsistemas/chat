import { DomainEvent } from './domain-event.base'

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

export class ImpedimentResolvedEvent extends DomainEvent {
  readonly eventName = 'impediment.resolved'

  constructor(
    public readonly impedimentId: string,
    public readonly taskId: string,
    public readonly unitId: string,
    public readonly resolvedByUserId: string,
  ) {
    super()
  }
}
