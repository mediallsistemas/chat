import { logger } from './logger'
import { config } from './config'
import { startConsumer, consumerState } from './stream-consumer'
import { shutdownRedis } from './redis-client'
import { startHealthServer } from './health-server'

let healthServer: ReturnType<typeof startHealthServer> | null = null

async function main() {
  logger.info('transcription-svc starting')
  // consumerState is a shared mutable object; the health server reads
  // .consumerActive on every request, so the flag stays accurate even
  // after startConsumer flips it.
  healthServer = startHealthServer(config.HEALTH_PORT, consumerState)
  await startConsumer()
}

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down')
  try {
    if (healthServer) {
      await new Promise<void>((resolve) => healthServer!.close(() => resolve()))
    }
    await shutdownRedis()
  } catch (err) {
    logger.error({ err }, 'error during shutdown')
  }
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

main().catch((err) => {
  logger.fatal({ err }, 'fatal startup error')
  process.exit(1)
})
