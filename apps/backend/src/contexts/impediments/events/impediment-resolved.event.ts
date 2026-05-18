import { DomainEvent } from '../../../shared/events'

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
