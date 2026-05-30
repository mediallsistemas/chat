import { z } from 'zod'

export const MeetingRecordingReadySchema = z.object({
  version: z.literal('1'),
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  meetingId: z.string().uuid(),
  unitId: z.string().uuid(),
  recordingUrl: z.string().url(),
  durationSec: z.number().int().nonnegative(),
})
export type MeetingRecordingReady = z.infer<typeof MeetingRecordingReadySchema>
