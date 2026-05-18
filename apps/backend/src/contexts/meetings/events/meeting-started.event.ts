import { DomainEvent } from '../../../shared/events'

export class MeetingStartedEvent extends DomainEvent {
  readonly eventName = 'meeting.started'

  constructor(
    public readonly unitId: string,
    public readonly payload: unknown,
  ) {
    super()
  }
}
