import { DomainEvent } from '../../../shared/events'

export class RecordingConsentUpdatedEvent extends DomainEvent {
  readonly eventName = 'meeting.recording_consent_updated'

  constructor(
    public readonly unitId: string,
    public readonly payload: unknown,
  ) {
    super()
  }
}
