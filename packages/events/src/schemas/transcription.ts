import { z } from 'zod'

/**
 * Published by the monolith when a meeting recording is uploaded and ready
 * to be transcribed. Consumed by transcription-svc.
 */
export const TranscriptionRequestedSchema = z.object({
  version: z.literal('1'),
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  meetingId: z.string().uuid(),
  recordingUrl: z.string().url(),
  unitId: z.string().uuid(),
  requestedBy: z.string().uuid(),
  /** Optional locale hint for the LLM (e.g. "pt-BR"). */
  locale: z.string().optional(),
})
export type TranscriptionRequested = z.infer<typeof TranscriptionRequestedSchema>

/**
 * Published by transcription-svc when transcription has been processed
 * successfully. The monolith consumes it to persist data and notify users.
 */
export const TranscriptionCompletedSchema = z.object({
  version: z.literal('1'),
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  meetingId: z.string().uuid(),
  unitId: z.string().uuid(),
  transcript: z.string(),
  summary: z.string().nullable(),
  keyDecisions: z.array(z.string()),
  actionItems: z.array(
    z.object({
      action: z.string(),
      owner: z.string().nullable(),
      deadline: z.string().nullable(),
    }),
  ),
})
export type TranscriptionCompleted = z.infer<typeof TranscriptionCompletedSchema>

/**
 * Published by transcription-svc when transcription fails permanently
 * (after retries). The monolith consumes it to surface the failure.
 */
export const TranscriptionFailedSchema = z.object({
  version: z.literal('1'),
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  meetingId: z.string().uuid(),
  unitId: z.string().uuid(),
  reason: z.string(),
  errorCode: z.string().optional(),
})
export type TranscriptionFailed = z.infer<typeof TranscriptionFailedSchema>
