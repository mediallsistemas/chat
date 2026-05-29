import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import Redis from 'ioredis'
import { randomUUID } from 'crypto'

/**
 * Publishes events to Redis Streams for cross-service communication.
 * Used by the monolith to dispatch work to extracted services
 * (transcription-svc, future realtime-svc).
 *
 * Async consumption (e.g. listening for TranscriptionCompleted from svc) is
 * handled by {@link RedisStreamsConsumerService}.
 */
@Injectable()
export class RedisStreamsPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisStreamsPublisher.name)
  private client!: Redis
  private shuttingDown = false

  onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    })
    this.client.on('error', (err) => {
      if (this.shuttingDown) return // suppress benign ECONNRESET during teardown
      this.logger.error('redis streams client error', err.stack)
    })
  }

  async onModuleDestroy() {
    this.shuttingDown = true
    if (this.client) {
      try {
        await this.client.quit()
      } catch {
        // ignore — already closed
      }
    }
  }

  /**
   * Publish a versioned event to a stream. The event must already include
   * `version`, `eventId`, and `occurredAt` (validated by its Zod schema
   * upstream).
   */
  async publish(streamName: string, event: Record<string, unknown>, extraFields?: Record<string, string>): Promise<string> {
    const fields: string[] = ['payload', JSON.stringify(event)]
    if (extraFields) {
      for (const [k, v] of Object.entries(extraFields)) {
        fields.push(k, v)
      }
    }
    const id = await this.client.xadd(streamName, '*', ...fields)
    this.logger.debug(`published to ${streamName} id=${id}`)
    return id ?? randomUUID()
  }

  /** Direct access for the consumer service to share the same connection pool. */
  getClient(): Redis {
    return this.client
  }
}
