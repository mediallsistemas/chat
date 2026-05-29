import { randomUUID } from 'crypto'
import {
  STREAM_NAMES,
  TranscriptionCompleted,
  TranscriptionCompletedSchema,
  TranscriptionFailed,
  TranscriptionFailedSchema,
  NotifyUserCrossService,
  NotifyUserCrossServiceSchema,
} from '@mediall/events'
import { redis } from './redis-client'
import { logger } from './logger'

async function publish(streamName: string, payload: unknown) {
  const json = JSON.stringify(payload)
  const id = await redis.xadd(streamName, '*', 'payload', json)
  logger.debug({ streamName, id }, 'event published')
  return id
}

export async function publishTranscriptionCompleted(
  data: Omit<TranscriptionCompleted, 'version' | 'eventId' | 'occurredAt'>,
) {
  const event: TranscriptionCompleted = {
    version: '1',
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    ...data,
  }
  TranscriptionCompletedSchema.parse(event)
  return publish(STREAM_NAMES.transcription.completed, event)
}

export async function publishTranscriptionFailed(
  data: Omit<TranscriptionFailed, 'version' | 'eventId' | 'occurredAt'>,
) {
  const event: TranscriptionFailed = {
    version: '1',
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    ...data,
  }
  TranscriptionFailedSchema.parse(event)
  return publish(STREAM_NAMES.transcription.failed, event)
}

export async function publishNotifyUser(
  data: Omit<NotifyUserCrossService, 'version' | 'eventId' | 'occurredAt'>,
) {
  const event: NotifyUserCrossService = {
    version: '1',
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    ...data,
  }
  NotifyUserCrossServiceSchema.parse(event)
  return publish(STREAM_NAMES.notifications.notifyUser, event)
}
