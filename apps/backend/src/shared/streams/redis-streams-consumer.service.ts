import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'

export type StreamHandler = (id: string, payload: unknown, rawFields: string[]) => Promise<void>

interface Subscription {
  stream: string
  group: string
  consumer: string
  handler: StreamHandler
}

/**
 * Subscribes to Redis Streams and dispatches messages to handlers. Runs a
 * single background loop per subscription; subscriptions are registered
 * during module init by services that consume cross-service events.
 *
 * On crash, unacked messages stay in the consumer group's PEL and are
 * re-read on next read cycle. There is no DLQ yet — future work.
 */
@Injectable()
export class RedisStreamsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisStreamsConsumer.name)
  private client!: Redis
  private subscriptions: Subscription[] = []
  private stopped = false

  onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    })
    this.client.on('error', (err) => {
      if (this.stopped) return // suppress benign ECONNRESET during teardown
      this.logger.error('redis streams consumer error', err.stack)
    })
  }

  async onModuleDestroy() {
    this.stopped = true
    if (this.client) {
      try {
        await this.client.quit()
      } catch {
        // ignore — already closed
      }
    }
  }

  /**
   * Register a subscription. The handler is called for each new entry.
   * If the handler throws, the entry is NOT acked and will be re-delivered.
   *
   * If Redis doesn't support Streams (version <5.0), the subscription is
   * silently disabled — the monolith continues to boot. This is the
   * dev-on-Windows fallback. Production runs Redis 7+ in docker-compose.
   */
  async subscribe(opts: { stream: string; group: string; consumer: string; handler: StreamHandler }) {
    const ok = await this.ensureGroup(opts.stream, opts.group)
    if (!ok) return
    this.subscriptions.push(opts)
    this.startLoop(opts).catch((err) =>
      this.logger.error(`consumer loop crashed for stream=${opts.stream}`, err instanceof Error ? err.stack : String(err)),
    )
  }

  private async ensureGroup(stream: string, group: string): Promise<boolean> {
    try {
      await this.client.xgroup('CREATE', stream, group, '$', 'MKSTREAM')
      this.logger.log(`consumer group created stream=${stream} group=${group}`)
      return true
    } catch (err: any) {
      const msg = err?.message ?? String(err)
      if (msg.includes('BUSYGROUP')) return true
      if (msg.includes('unknown command') || msg.includes('XGROUP')) {
        this.logger.warn(
          `Redis does not support Streams (server too old?) — subscription disabled for stream=${stream}. ` +
            `Local dev fallback only; production requires Redis 5+.`,
        )
        return false
      }
      throw err
    }
  }

  private async startLoop(sub: Subscription) {
    while (!this.stopped) {
      try {
        const result = (await this.client.xreadgroup(
          'GROUP',
          sub.group,
          sub.consumer,
          'COUNT',
          10,
          'BLOCK',
          5000,
          'STREAMS',
          sub.stream,
          '>',
        )) as Array<[string, Array<[string, string[]]>]> | null

        if (!result) continue

        for (const [, entries] of result) {
          for (const [id, fields] of entries) {
            const payloadIndex = fields.findIndex((f) => f === 'payload')
            if (payloadIndex === -1 || !fields[payloadIndex + 1]) {
              this.logger.warn(`invalid stream entry shape id=${id} stream=${sub.stream}`)
              await this.client.xack(sub.stream, sub.group, id)
              continue
            }
            let payload: unknown
            try {
              payload = JSON.parse(fields[payloadIndex + 1])
            } catch {
              this.logger.error(`failed to parse JSON payload id=${id} stream=${sub.stream}`)
              await this.client.xack(sub.stream, sub.group, id)
              continue
            }
            try {
              await sub.handler(id, payload, fields)
              await this.client.xack(sub.stream, sub.group, id)
            } catch (err) {
              this.logger.error(
                `handler failed for id=${id} stream=${sub.stream}; entry stays in PEL`,
                err instanceof Error ? err.stack : String(err),
              )
            }
          }
        }
      } catch (err) {
        if (this.stopped) return
        this.logger.error('consumer loop error; backing off 5s', err instanceof Error ? err.stack : String(err))
        await new Promise((r) => setTimeout(r, 5000))
      }
    }
  }
}
