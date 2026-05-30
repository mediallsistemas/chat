import { DomainEvent } from './domain-event.base'

export class TranscriptionRequested extends DomainEvent {
  readonly eventName = 'transcription.requested'
  constructor(
    public readonly meetingId: string,
    public readonly recordingUrl: string,
    public readonly unitId: string,
  ) {
    super()
  }
}

export class TranscriptionCompleted extends DomainEvent {
  readonly eventName = 'transcription.completed'
  constructor(
    public readonly meetingId: string,
    public readonly transcriptId: string,
    public readonly unitId: string,
    public readonly summary: string | null,
  ) {
    super()
  }
}

export class TranscriptionFailed extends DomainEvent {
  readonly eventName = 'transcription.failed'
  constructor(
    public readonly meetingId: string,
    public readonly reason: string,
  ) {
    super()
  }
}
