import { DomainEvent } from '../../../shared/events'

export class MeetingUpdatedEvent extends DomainEvent {
  readonly eventName = 'meeting.updated'

  constructor(
    public readonly unitId: string,
    public readonly payload: unknown,
  ) {
    super()
  }
}
