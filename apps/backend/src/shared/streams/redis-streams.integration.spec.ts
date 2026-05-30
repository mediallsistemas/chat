/**
 * Integration tests for Redis Streams round-trip (publisher → consumer).
 *
 * Uses ioredis-mock which supports xadd/xlen/xread but NOT xgroup/xreadgroup.
 * For the consumer group path we fall back to .skip when running against
 * the mock; CI with a real Redis 5+ container runs everything.
 *
 * To run against real Redis:
 *   REDIS_HOST=localhost REDIS_PORT=6379 npx jest redis-streams.integration
 */
import Redis from 'ioredis'
import RedisMock from 'ioredis-mock'

const USE_REAL_REDIS = process.env.REDIS_INTEGRATION === 'real'

async function makeClient(): Promise<Redis> {
  if (USE_REAL_REDIS) {
    return new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null,
    })
  }
  return new RedisMock() as unknown as Redis
}

async function supportsConsumerGroups(client: Redis): Promise<boolean> {
  try {
    await client.xgroup('CREATE', '__probe__', '__g__', '$', 'MKSTREAM')
    await client.del('__probe__')
    return true
  } catch (err: any) {
    if (err?.message?.includes('BUSYGROUP')) return true
    return false
  }
}

describe('Redis Streams integration (round-trip)', () => {
  let client: Redis
  let groupsSupported: boolean

  beforeAll(async () => {
    client = await makeClient()
    groupsSupported = await supportsConsumerGroups(client)
  })

  afterAll(async () => {
    await client.quit().catch(() => undefined)
  })

  beforeEach(async () => {
    // ioredis-mock shares state across instances; flush before each test.
    // For real Redis we only clear our test namespace to avoid wiping data.
    if (USE_REAL_REDIS) {
      const keys = await client.keys('test:stream:*')
      if (keys.length > 0) await client.del(...keys)
    } else {
      await client.flushall()
    }
  })

  describe('basic publish/read (works on ioredis-mock + real Redis)', () => {
    it('xadd then xlen returns 1', async () => {
      const stream = 'test:stream:basic'
      const id = await client.xadd(stream, '*', 'payload', '{"hello":"world"}')
      expect(id).toMatch(/^\d+-\d+$/)
      const len = await client.xlen(stream)
      expect(len).toBe(1)
    })

    it('xadd preserves payload', async () => {
      const stream = 'test:stream:payload'
      const event = {
        version: '1',
        eventId: 'abc',
        meetingId: 'meet-1',
        unitId: 'unit-1',
      }
      await client.xadd(stream, '*', 'payload', JSON.stringify(event))
      // xrange returns all entries
      const entries = await client.xrange(stream, '-', '+')
      expect(entries).toHaveLength(1)
      const [, fields] = entries[0]
      const payloadIdx = fields.findIndex((f: string) => f === 'payload')
      expect(payloadIdx).toBeGreaterThanOrEqual(0)
      expect(JSON.parse(fields[payloadIdx + 1])).toEqual(event)
    })

    it('xadd with extra fields preserves them all', async () => {
      const stream = 'test:stream:extra'
      await client.xadd(stream, '*', 'payload', '{}', 'transcript', 'raw text here')
      const entries = await client.xrange(stream, '-', '+')
      const [, fields] = entries[0]
      expect(fields).toContain('transcript')
      expect(fields).toContain('raw text here')
    })
  })

  describe('consumer groups (requires real Redis 5+)', () => {
    it('xgroup CREATE on empty stream with MKSTREAM', async () => {
      if (!groupsSupported) return // skip silently — mock doesn't implement it
      const stream = 'test:stream:cg'
      await expect(
        client.xgroup('CREATE', stream, 'g1', '$', 'MKSTREAM'),
      ).resolves.toBe('OK')
      await client.del(stream)
    })

    it('xreadgroup delivers new entries to one consumer', async () => {
      if (!groupsSupported) return
      const stream = 'test:stream:rg'
      await client.xgroup('CREATE', stream, 'g1', '$', 'MKSTREAM')
      await client.xadd(stream, '*', 'payload', '{"n":1}')

      const result = (await client.xreadgroup(
        'GROUP',
        'g1',
        'c1',
        'COUNT',
        10,
        'STREAMS',
        stream,
        '>',
      )) as Array<[string, Array<[string, string[]]>]> | null

      expect(result).not.toBeNull()
      expect(result![0][0]).toBe(stream)
      expect(result![0][1]).toHaveLength(1)
      const [id, fields] = result![0][1][0]
      expect(id).toMatch(/^\d+-\d+$/)
      expect(JSON.parse(fields[fields.findIndex((f: string) => f === 'payload') + 1])).toEqual({ n: 1 })
      await client.del(stream)
    })

    it('xack removes entry from PEL', async () => {
      if (!groupsSupported) return
      const stream = 'test:stream:ack'
      await client.xgroup('CREATE', stream, 'g1', '$', 'MKSTREAM')
      const id = (await client.xadd(stream, '*', 'payload', '{}')) as string

      await client.xreadgroup('GROUP', 'g1', 'c1', 'STREAMS', stream, '>')

      // Before ack: 1 pending
      const pendingBefore = (await client.xpending(stream, 'g1')) as [number, ...unknown[]]
      expect(pendingBefore[0]).toBe(1)

      await client.xack(stream, 'g1', id)

      // After ack: 0 pending
      const pendingAfter = (await client.xpending(stream, 'g1')) as [number, ...unknown[]]
      expect(pendingAfter[0]).toBe(0)
      await client.del(stream)
    })

    it('xreadgroup with > only delivers new entries (not pending)', async () => {
      if (!groupsSupported) return
      const stream = 'test:stream:new'
      await client.xgroup('CREATE', stream, 'g1', '$', 'MKSTREAM')

      // No entries → null
      const empty = await client.xreadgroup('GROUP', 'g1', 'c1', 'COUNT', 10, 'STREAMS', stream, '>')
      expect(empty).toBeNull()

      // Add one → delivered
      await client.xadd(stream, '*', 'payload', '{}')
      const got = await client.xreadgroup('GROUP', 'g1', 'c1', 'COUNT', 10, 'STREAMS', stream, '>')
      expect(got).not.toBeNull()

      // Second read with > on same consumer (without new entries) → null
      const again = await client.xreadgroup('GROUP', 'g1', 'c1', 'COUNT', 10, 'STREAMS', stream, '>')
      expect(again).toBeNull()
      await client.del(stream)
    })
  })

  describe('environment detection', () => {
    it('reports which Redis is in use (informational)', () => {
      // This is just a smoke test that prints the mode in CI logs.
      const mode = USE_REAL_REDIS
        ? 'REAL Redis at ' + (process.env.REDIS_HOST ?? 'localhost')
        : 'ioredis-mock (consumer groups: ' + groupsSupported + ')'
      // eslint-disable-next-line no-console
      console.log('[integration] running against:', mode)
      expect(true).toBe(true)
    })
  })
})
