import { DomainEvent } from '../../../shared/events'

export class RecordingStoppedEvent extends DomainEvent {
  readonly eventName = 'meeting.recording_stopped'

  constructor(
    public readonly unitId: string,
    public readonly payload: unknown,
  ) {
    super()
  }
}
