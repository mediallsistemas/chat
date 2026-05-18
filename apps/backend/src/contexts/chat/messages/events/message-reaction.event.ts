import { DomainEvent } from '../../../../shared/events'

export class MessageReactionEvent extends DomainEvent {
  readonly eventName = 'message.reaction'

  constructor(
    public readonly groupId: string,
    public readonly unitId: string,
    public readonly payload: unknown,
  ) {
    super()
  }
}
