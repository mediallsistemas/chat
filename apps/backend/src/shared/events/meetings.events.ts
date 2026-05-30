import { DomainEvent } from './domain-event.base'

export class MeetingRecordingReady extends DomainEvent {
  readonly eventName = 'meetings.recording.ready'
  constructor(
    public readonly meetingId: string,
    public readonly recordingUrl: string,
    public readonly unitId: string,
    public readonly durationSec: number,
  ) {
    super()
  }
}

export class MeetingScheduled extends DomainEvent {
  readonly eventName = 'meetings.scheduled'
  constructor(
    public readonly meetingId: string,
    public readonly unitId: string,
    public readonly createdBy: string,
    public readonly participantIds: string[],
    public readonly startAt: Date,
  ) {
    super()
  }
}
