import {
  STREAM_NAMES,
  CONSUMER_GROUPS,
  TranscriptionRequestedSchema,
} from '@mediall/events'
import { redis } from './redis-client'
import { config } from './config'
import { logger } from './logger'
import { processTranscription } from './transcription-processor'

const STREAM = STREAM_NAMES.transcription.requested
const GROUP = CONSUMER_GROUPS.transcriptionSvc.requestedConsumer

async function ensureGroup(): Promise<boolean> {
  try {
    await redis.xgroup('CREATE', STREAM, GROUP, '$', 'MKSTREAM')
    logger.info({ stream: STREAM, group: GROUP }, 'consumer group created')
    return true
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    if (msg.includes('BUSYGROUP')) {
      logger.debug({ stream: STREAM, group: GROUP }, 'consumer group already exists')
      return true
    }
    if (msg.includes('unknown command') || msg.includes('XGROUP')) {
      // Redis < 5 → Streams not available. We can't usefully run, but don't
      // crash — log loudly so dev environments understand why nothing happens.
      logger.warn(
        { stream: STREAM, group: GROUP, err: msg },
        'Redis does not support Streams (requires Redis 5+). Consumer will idle. ' +
          'Production uses Redis 7-alpine via docker-compose.',
      )
      return false
    }
    throw err
  }
}

async function handleEntry(id: string, fields: string[]) {
  const payloadIndex = fields.findIndex((f) => f === 'payload')
  if (payloadIndex === -1 || !fields[payloadIndex + 1]) {
    logger.warn({ id, fields }, 'invalid stream entry shape, skipping')
    return
  }

  let parsed
  try {
    parsed = JSON.parse(fields[payloadIndex + 1])
  } catch (err) {
    logger.error({ err, id }, 'failed to parse JSON payload')
    return
  }

  const validation = TranscriptionRequestedSchema.safeParse(parsed)
  if (!validation.success) {
    logger.error({ id, issues: validation.error.issues }, 'invalid event schema, skipping (DLQ candidate)')
    return
  }

  const event = validation.data

  /* Raw transcript travels via separate field for now (Redis values are
   * binary-safe). When we move to audio streaming, the recordingUrl will
   * be downloaded directly inside the processor. */
  const transcriptIndex = fields.findIndex((f) => f === 'transcript')
  const rawTranscript = transcriptIndex !== -1 ? fields[transcriptIndex + 1] ?? '' : ''

  try {
    await processTranscription(event, rawTranscript)
    await redis.xack(STREAM, GROUP, id)
  } catch (err) {
    logger.error({ err, id, meetingId: event.meetingId }, 'processing failed; entry stays pending for redelivery')
    /* No XACK — entry stays in PEL and will be re-read by next pending claim
     * cycle. After MAX_RETRIES we will move to a dead-letter stream (future). */
  }
}

/**
 * Mutable state visible to the health endpoint so /health can report
 * whether the consumer is actually running or idling on an old Redis.
 */
export const consumerState = { active: false }

export async function startConsumer() {
  const ok = await ensureGroup()
  if (!ok) {
    logger.warn('consumer idling (Streams unsupported); service will exit when Redis is upgraded')
    // Idle forever — Docker should restart with a proper Redis on next deploy.
    await new Promise(() => undefined)
    return
  }
  consumerState.active = true
  logger.info({ stream: STREAM, group: GROUP, consumer: config.CONSUMER_NAME }, 'consumer starting')

  /* Loop: blocking XREADGROUP. ioredis returns null on timeout. */
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const result = (await redis.xreadgroup(
        'GROUP',
        GROUP,
        config.CONSUMER_NAME,
        'COUNT',
        10,
        'BLOCK',
        config.POLL_BLOCK_MS,
        'STREAMS',
        STREAM,
        '>',
      )) as Array<[string, Array<[string, string[]]>]> | null

      if (!result) continue

      for (const [, entries] of result) {
        for (const [id, fields] of entries) {
          await handleEntry(id, fields)
        }
      }
    } catch (err) {
      logger.error({ err }, 'consumer loop error; backing off 5s')
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}
