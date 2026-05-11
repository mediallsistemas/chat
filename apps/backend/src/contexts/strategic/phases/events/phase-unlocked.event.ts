import { DomainEvent } from '../../../shared/events'

export class PhaseUnlockedEvent extends DomainEvent {
  readonly eventName = 'phase.unlocked'

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
