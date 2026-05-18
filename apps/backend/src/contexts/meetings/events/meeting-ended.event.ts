import { DomainEvent } from '../../../shared/events'

export class MeetingEndedEvent extends DomainEvent {
  readonly eventName = 'meeting.ended'

  constructor(
    public readonly unitId: string,
    public readonly payload: unknown,
  ) {
    super()
  }
}
