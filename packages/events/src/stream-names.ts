/**
 * Centralized Redis Stream names. Both monolith and svcs import from here so
 * a typo in one place can't decouple producer from consumer silently.
 */
export const STREAM_NAMES = {
  transcription: {
    requested: 'stream:transcription.requested.v1',
    completed: 'stream:transcription.completed.v1',
    failed: 'stream:transcription.failed.v1',
  },
  meetings: {
    recordingReady: 'stream:meetings.recording_ready.v1',
  },
  notifications: {
    notifyUser: 'stream:notifications.notify_user.v1',
  },
} as const

export type StreamName =
  | typeof STREAM_NAMES.transcription[keyof typeof STREAM_NAMES.transcription]
  | typeof STREAM_NAMES.meetings[keyof typeof STREAM_NAMES.meetings]
  | typeof STREAM_NAMES.notifications[keyof typeof STREAM_NAMES.notifications]

/** Consumer group naming convention: `<svc-name>-<purpose>`. */
export const CONSUMER_GROUPS = {
  transcriptionSvc: {
    requestedConsumer: 'transcription-svc-requested',
  },
  monolith: {
    completedConsumer: 'monolith-transcription-completed',
    failedConsumer: 'monolith-transcription-failed',
  },
} as const
