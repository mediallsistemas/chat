import { DomainEvent } from '../../../shared/events'

export class MeetingReminderDueEvent extends DomainEvent {
  readonly eventName = 'meeting.reminder_due'

  constructor(
    public readonly meetingId: string,
    public readonly meetingTitle: string,
    public readonly unitId: string,
    public readonly participantUserIds: string[],
    public readonly minutesUntilStart: number,
  ) {
    super()
  }
}
