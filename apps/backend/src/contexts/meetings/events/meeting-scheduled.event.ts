import { DomainEvent } from '../../../shared/events'

export class MeetingScheduledEvent extends DomainEvent {
  readonly eventName = 'meeting.scheduled'

  constructor(
    public readonly meetingId: string,
    public readonly meetingTitle: string,
    public readonly unitId: string,
    public readonly creatorName: string,
    public readonly invitedUserIds: string[],
  ) {
    super()
  }
}
