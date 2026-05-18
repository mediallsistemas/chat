import { DomainEvent } from '../../../../shared/events'

export class MessageSentEvent extends DomainEvent {
  readonly eventName = 'message.sent'

  constructor(
    public readonly groupId: string,
    public readonly unitId: string,
    public readonly payload: unknown,
  ) {
    super()
  }
}
