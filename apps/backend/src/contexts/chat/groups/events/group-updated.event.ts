import { DomainEvent } from '../../../../shared/events'

export class GroupUpdatedEvent extends DomainEvent {
  readonly eventName = 'group.updated'

  constructor(
    public readonly groupId: string,
    public readonly unitId: string,
    public readonly payload: unknown,
  ) {
    super()
  }
}
