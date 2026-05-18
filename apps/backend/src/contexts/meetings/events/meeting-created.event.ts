import { DomainEvent } from '../../../shared/events'

export class MeetingCreatedEvent extends DomainEvent {
  readonly eventName = 'meeting.created'

  constructor(
    public readonly unitId: string,
    public readonly payload: unknown,
  ) {
    super()
  }
}
