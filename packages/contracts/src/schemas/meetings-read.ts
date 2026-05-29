import { z } from 'zod'

/**
 * Contract for: GET /internal/v1/meetings/:id (called by transcription-svc).
 * Auth: service-to-service token via x-internal-token header.
 */
export const MeetingReadDtoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  unitId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  participantUserIds: z.array(z.string().uuid()),
  createdBy: z.string().uuid(),
})
export type MeetingReadDto = z.infer<typeof MeetingReadDtoSchema>

export const MEETINGS_READ_ROUTE = '/internal/v1/meetings/:id'
