import { DomainEvent } from '../../../shared/events'

export class MessageDeletedEvent extends DomainEvent {
  readonly eventName = 'message.deleted'

  constructor(
    public readonly groupId: string,
    public readonly unitId: string,
    public readonly payload: unknown,
  ) {
    super()
  }
}
