import { DomainEvent } from '../../../shared/events'

export class RecordingStartedEvent extends DomainEvent {
  readonly eventName = 'meeting.recording_started'

  constructor(
    public readonly unitId: string,
    public readonly meetingId: string,
  ) {
    super()
  }
}
