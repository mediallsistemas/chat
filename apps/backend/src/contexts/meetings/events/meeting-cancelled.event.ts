import { DomainEvent } from '../../shared/events'

export class MeetingCancelledEvent extends DomainEvent {
  readonly eventName = 'meeting.cancelled'

  constructor(
    public readonly unitId: string,
    public readonly payload: unknown,
  ) {
    super()
  }
}
