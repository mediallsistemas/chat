import { DomainEvent } from '../../shared/events'

export class RecordingConsentRequestedEvent extends DomainEvent {
  readonly eventName = 'meeting.recording_consent_requested'

  constructor(
    public readonly unitId: string,
    public readonly meetingId: string,
  ) {
    super()
  }
}
