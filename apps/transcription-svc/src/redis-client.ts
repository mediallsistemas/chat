import Redis from 'ioredis'
import { config } from './config'
import { logger } from './logger'

export const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
})

redis.on('connect', () => logger.info('redis connected'))
redis.on('error', (err) => logger.error({ err }, 'redis error'))

export async function shutdownRedis() {
  await redis.quit()
}
