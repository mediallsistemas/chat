import { DomainEvent } from './domain-event.base'

export class MessagePosted extends DomainEvent {
  readonly eventName = 'chat.message.posted'
  constructor(
    public readonly messageId: string,
    public readonly groupId: string,
    public readonly senderId: string,
    public readonly unitId: string | null,
    public readonly mentionedUserIds: string[] = [],
  ) {
    super()
  }
}

export class DirectMessagePosted extends DomainEvent {
  readonly eventName = 'chat.direct_message.posted'
  constructor(
    public readonly messageId: string,
    public readonly groupId: string,
    public readonly senderId: string,
    public readonly recipientId: string,
  ) {
    super()
  }
}
