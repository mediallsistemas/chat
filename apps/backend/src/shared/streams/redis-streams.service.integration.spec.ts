/**
 * Integration tests for RedisStreamsPublisher using the real service class
 * but injecting an ioredis-mock client. This validates the publish payload
 * shape and stream naming end-to-end.
 */
import RedisMock from 'ioredis-mock'
import { RedisStreamsPublisher } from './redis-streams.service'
import { STREAM_NAMES } from '@mediall/events'

describe('RedisStreamsPublisher (integration with ioredis-mock)', () => {
  let publisher: RedisStreamsPublisher
  let mock: any

  beforeEach(async () => {
    publisher = new RedisStreamsPublisher()
    mock = new RedisMock()
    // ioredis-mock shares state across instances — clear before each test
    await mock.flushall()
    // bypass onModuleInit's real Redis connection — inject the mock
    ;(publisher as any).client = mock
  })

  afterEach(async () => {
    await publisher.onModuleDestroy()
  })

  it('publish writes a stream entry with the payload field', async () => {
    const event = { version: '1', eventId: 'e1', meetingId: 'm1', unitId: 'u1' }
    const id = await publisher.publish(STREAM_NAMES.transcription.requested, event)

    expect(id).toMatch(/^\d+-\d+$/)

    const entries = await mock.xrange(STREAM_NAMES.transcription.requested, '-', '+')
    expect(entries).toHaveLength(1)
    const [returnedId, fields] = entries[0]
    expect(returnedId).toBe(id)
    const payloadIdx = fields.findIndex((f: string) => f === 'payload')
    expect(JSON.parse(fields[payloadIdx + 1])).toEqual(event)
  })

  it('publish supports extraFields next to payload', async () => {
    const event = { version: '1', eventId: 'e2', meetingId: 'm1' }
    await publisher.publish(STREAM_NAMES.transcription.requested, event, {
      transcript: 'raw text here',
    })

    const entries = await mock.xrange(STREAM_NAMES.transcription.requested, '-', '+')
    const [, fields] = entries[0]
    expect(fields).toContain('transcript')
    expect(fields[fields.indexOf('transcript') + 1]).toBe('raw text here')
  })

  it('multiple publishes preserve order via incrementing IDs', async () => {
    const e1 = { version: '1', eventId: 'a' }
    const e2 = { version: '1', eventId: 'b' }
    const e3 = { version: '1', eventId: 'c' }

    const id1 = await publisher.publish('test:order', e1)
    const id2 = await publisher.publish('test:order', e2)
    const id3 = await publisher.publish('test:order', e3)

    const entries = await mock.xrange('test:order', '-', '+')
    expect(entries.map((e: any) => e[0])).toEqual([id1, id2, id3])
  })

  it('publishes to different streams independently', async () => {
    await publisher.publish(STREAM_NAMES.transcription.requested, { version: '1', eventId: 'a' })
    await publisher.publish(STREAM_NAMES.transcription.completed, { version: '1', eventId: 'b' })
    await publisher.publish(STREAM_NAMES.notifications.notifyUser, { version: '1', eventId: 'c' })

    expect(await mock.xlen(STREAM_NAMES.transcription.requested)).toBe(1)
    expect(await mock.xlen(STREAM_NAMES.transcription.completed)).toBe(1)
    expect(await mock.xlen(STREAM_NAMES.notifications.notifyUser)).toBe(1)
  })

  it('getClient returns the underlying connection', () => {
    expect(publisher.getClient()).toBe(mock)
  })
})
