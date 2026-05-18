import { DomainEvent } from '../../../../shared/events'

export class PhaseCompletedEvent extends DomainEvent {
  readonly eventName = 'phase.completed'

  constructor(
    public readonly phaseId: string,
    public readonly phaseTitle: string,
    public readonly goalId: string,
    public readonly unitId: string,
    public readonly responsibleUserId: string | null,
  ) {
    super()
  }
}
