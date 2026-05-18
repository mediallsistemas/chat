import { DomainEvent } from '../../../../shared/events'

export class MessageEditedEvent extends DomainEvent {
  readonly eventName = 'message.edited'

  constructor(
    public readonly groupId: string,
    public readonly unitId: string,
    public readonly payload: unknown,
  ) {
    super()
  }
}
