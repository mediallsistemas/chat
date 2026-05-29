import { RedisStreamsConsumer } from './redis-streams-consumer.service'

/**
 * Unit tests for the consumer's resilience knobs. Full streams integration
 * is covered by manual + e2e against a real Redis 7 container.
 */
describe('RedisStreamsConsumer', () => {
  function makeConsumer(xgroupImpl: jest.Mock) {
    const consumer = new RedisStreamsConsumer()
    // bypass onModuleInit's real Redis connection
    ;(consumer as any).client = {
      xgroup: xgroupImpl,
      xreadgroup: jest.fn().mockResolvedValue(null),
      xack: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
    }
    return consumer
  }

  it('subscribes successfully when xgroup CREATE succeeds', async () => {
    const xgroup = jest.fn().mockResolvedValue('OK')
    const consumer = makeConsumer(xgroup)
    const handler = jest.fn()

    await consumer.subscribe({
      stream: 'test:stream',
      group: 'test-group',
      consumer: 'test-consumer',
      handler,
    })

    expect(xgroup).toHaveBeenCalledWith('CREATE', 'test:stream', 'test-group', '$', 'MKSTREAM')
    await consumer.onModuleDestroy()
  })

  it('subscribes successfully when group already exists (BUSYGROUP)', async () => {
    const xgroup = jest.fn().mockRejectedValue(new Error('BUSYGROUP Consumer Group name already exists'))
    const consumer = makeConsumer(xgroup)

    await expect(
      consumer.subscribe({
        stream: 'test:stream',
        group: 'test-group',
        consumer: 'test-consumer',
        handler: jest.fn(),
      }),
    ).resolves.toBeUndefined()

    await consumer.onModuleDestroy()
  })

  it('skips subscription gracefully when Redis is too old for Streams', async () => {
    const xgroup = jest.fn().mockRejectedValue(new Error("ERR unknown command 'xgroup'"))
    const consumer = makeConsumer(xgroup)
    const handler = jest.fn()

    await expect(
      consumer.subscribe({
        stream: 'test:stream',
        group: 'test-group',
        consumer: 'test-consumer',
        handler,
      }),
    ).resolves.toBeUndefined()

    // No subscription registered → handler never runs
    expect((consumer as any).subscriptions).toHaveLength(0)
    await consumer.onModuleDestroy()
  })

  it('propagates unexpected errors during ensureGroup', async () => {
    const xgroup = jest.fn().mockRejectedValue(new Error('NOPERM access denied'))
    const consumer = makeConsumer(xgroup)

    await expect(
      consumer.subscribe({
        stream: 'test:stream',
        group: 'test-group',
        consumer: 'test-consumer',
        handler: jest.fn(),
      }),
    ).rejects.toThrow('NOPERM access denied')

    await consumer.onModuleDestroy()
  })
})
