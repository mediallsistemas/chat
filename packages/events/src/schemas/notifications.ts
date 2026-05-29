import { z } from 'zod'

/**
 * Cross-service notification request. Used when a separate service (e.g.
 * transcription-svc) needs to trigger a user notification handled by the
 * monolith's NotificationsService.
 */
export const NotifyUserCrossServiceSchema = z.object({
  version: z.literal('1'),
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  userId: z.string().uuid(),
  unitId: z.string().uuid().optional(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
})
export type NotifyUserCrossService = z.infer<typeof NotifyUserCrossServiceSchema>
