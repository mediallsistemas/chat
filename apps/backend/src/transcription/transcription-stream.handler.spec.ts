import { EventEmitter2 } from '@nestjs/event-emitter'
import { TranscriptionStreamHandler } from './transcription-stream.handler'
import { RedisStreamsConsumer } from '../shared/streams/redis-streams-consumer.service'
import { EventBusService, NotifyUserRequested } from '../shared/events'
import { STREAM_NAMES, CONSUMER_GROUPS } from '@mediall/events'

/**
 * Validates the inbound side of the monolith ↔ transcription-svc contract:
 *   transcription.completed  → DB write
 *   transcription.failed     → log only (no DB)
 *   notifications.notify_user → EventBus republish for in-process delivery
 *
 * Approach: subscribe() is mocked to capture the handler functions, then we
 * invoke them directly with parsed payloads — same behavior as if Redis had
 * delivered a real entry.
 */
describe('TranscriptionStreamHandler', () => {
  type CapturedSub = {
    stream: string
    group: string
    consumer: string
    handler: (id: string, payload: unknown, rawFields: string[]) => Promise<void>
  }

  function setup() {
    const captured: CapturedSub[] = []
    const consumer = {
      subscribe: jest.fn(async (opts: CapturedSub) => {
        captured.push(opts)
      }),
    } as unknown as RedisStreamsConsumer

    const prisma = {
      meeting: { update: jest.fn().mockResolvedValue(undefined) },
    } as any

    const emitter = new EventEmitter2({ wildcard: true, delimiter: '.' })
    const eventBus = new EventBusService(emitter)

    const handler = new TranscriptionStreamHandler(consumer, prisma, eventBus)
    return { handler, consumer, prisma, emitter, captured }
  }

  const VALID_MEETING_ID = '11111111-1111-1111-1111-111111111111'
  const VALID_UNIT_ID = '22222222-2222-2222-2222-222222222222'
  const VALID_USER_ID = '33333333-3333-3333-3333-333333333333'
  const VALID_EVENT_ID = '44444444-4444-4444-4444-444444444444'

  it('subscribes to all 3 streams with the correct groups on init', async () => {
    const { handler, captured } = setup()
    await handler.onModuleInit()

    const byStream = Object.fromEntries(captured.map((c) => [c.stream, c]))
    expect(byStream[STREAM_NAMES.transcription.completed].group).toBe(
      CONSUMER_GROUPS.monolith.completedConsumer,
    )
    expect(byStream[STREAM_NAMES.transcription.failed].group).toBe(
      CONSUMER_GROUPS.monolith.failedConsumer,
    )
    expect(byStream[STREAM_NAMES.notifications.notifyUser].group).toBe(
      'monolith-notify-user-cross-service',
    )
  })

  describe('TranscriptionCompleted handler', () => {
    it('persists the transcript + summary to the meeting row', async () => {
      const { handler, captured, prisma } = setup()
      await handler.onModuleInit()

      const completedHandler = captured.find(
        (c) => c.stream === STREAM_NAMES.transcription.completed,
      )!.handler

      await completedHandler('1-0', {
        version: '1',
        eventId: VALID_EVENT_ID,
        occurredAt: new Date().toISOString(),
        meetingId: VALID_MEETING_ID,
        unitId: VALID_UNIT_ID,
        transcript: 'full transcript text',
        summary: 'short summary',
        keyDecisions: ['decision 1'],
        actionItems: [{ action: 'do x', owner: 'me', deadline: null }],
      }, [])

      expect(prisma.meeting.update).toHaveBeenCalledTimes(1)
      const call = prisma.meeting.update.mock.calls[0][0]
      expect(call.where.id).toBe(VALID_MEETING_ID)
      expect(call.data.transcript).toBe('full transcript text')
      expect(call.data.transcriptSummary).toBe('short summary')
      expect(call.data.transcriptedAt).toBeInstanceOf(Date)
      expect(call.data.transcriptActionItems).toEqual({
        summary: 'short summary',
        keyDecisions: ['decision 1'],
        actionItems: [{ action: 'do x', owner: 'me', deadline: null }],
      })
    })

    it('silently skips when the payload schema is invalid', async () => {
      const { handler, captured, prisma } = setup()
      await handler.onModuleInit()
      const completedHandler = captured.find(
        (c) => c.stream === STREAM_NAMES.transcription.completed,
      )!.handler

      await completedHandler('1-0', { totally: 'wrong' }, [])

      expect(prisma.meeting.update).not.toHaveBeenCalled()
    })
  })

  describe('TranscriptionFailed handler', () => {
    it('does not touch the DB but logs the failure', async () => {
      const { handler, captured, prisma } = setup()
      await handler.onModuleInit()
      const failedHandler = captured.find(
        (c) => c.stream === STREAM_NAMES.transcription.failed,
      )!.handler

      await failedHandler('1-0', {
        version: '1',
        eventId: VALID_EVENT_ID,
        occurredAt: new Date().toISOString(),
        meetingId: VALID_MEETING_ID,
        unitId: VALID_UNIT_ID,
        reason: 'anthropic timeout',
      }, [])

      expect(prisma.meeting.update).not.toHaveBeenCalled()
    })

    it('skips silently on invalid payload', async () => {
      const { handler, captured, prisma } = setup()
      await handler.onModuleInit()
      const failedHandler = captured.find(
        (c) => c.stream === STREAM_NAMES.transcription.failed,
      )!.handler

      await failedHandler('1-0', { bad: true }, [])
      expect(prisma.meeting.update).not.toHaveBeenCalled()
    })
  })

  describe('NotifyUserCrossService handler', () => {
    it('republishes as in-process NotifyUserRequested on the EventBus', async () => {
      const { handler, captured, emitter } = setup()
      await handler.onModuleInit()

      const captured$ = jest.fn()
      emitter.on('notification.notify_user.requested', captured$)

      const notifyHandler = captured.find(
        (c) => c.stream === STREAM_NAMES.notifications.notifyUser,
      )!.handler

      await notifyHandler('1-0', {
        version: '1',
        eventId: VALID_EVENT_ID,
        occurredAt: new Date().toISOString(),
        userId: VALID_USER_ID,
        unitId: VALID_UNIT_ID,
        type: 'TRANSCRIPT_READY',
        title: 'Transcrição disponível',
        body: 'Sua reunião foi transcrita.',
        entityType: 'meeting',
        entityId: VALID_MEETING_ID,
      }, [])

      expect(captured$).toHaveBeenCalledTimes(1)
      const republished = captured$.mock.calls[0][0] as NotifyUserRequested
      expect(republished).toBeInstanceOf(NotifyUserRequested)
      expect(republished.payload).toEqual({
        userId: VALID_USER_ID,
        unitId: VALID_UNIT_ID,
        type: 'TRANSCRIPT_READY',
        title: 'Transcrição disponível',
        body: 'Sua reunião foi transcrita.',
        entityType: 'meeting',
        entityId: VALID_MEETING_ID,
      })
    })

    it('skips silently on invalid cross-service payload', async () => {
      const { handler, captured, emitter } = setup()
      await handler.onModuleInit()

      const captured$ = jest.fn()
      emitter.on('notification.notify_user.requested', captured$)

      const notifyHandler = captured.find(
        (c) => c.stream === STREAM_NAMES.notifications.notifyUser,
      )!.handler

      await notifyHandler('1-0', { not: 'valid' }, [])
      expect(captured$).not.toHaveBeenCalled()
    })
  })
})
