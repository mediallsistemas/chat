import http from 'http'
import { redis } from './redis-client'
import { logger } from './logger'

/**
 * Minimal HTTP healthcheck endpoint for the worker.
 *
 * GET /health → 200 if Redis is reachable AND consumer is running.
 *               503 otherwise.
 *
 * Used by Docker healthcheck and by uptime probes. Kept on a separate
 * port (default 4001) so it doesn't conflict with the monolith.
 */
export interface HealthState {
  active: boolean
}

export function startHealthServer(port: number, state: HealthState) {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      try {
        await redis.ping()
        const status = state.active ? 'ok' : 'degraded'
        const code = state.active ? 200 : 503
        res.writeHead(code, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            status,
            redis: 'up',
            consumer: state.active ? 'running' : 'idle',
            uptimeSec: Math.floor(process.uptime()),
          }),
        )
      } catch (err) {
        res.writeHead(503, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            status: 'down',
            redis: 'unreachable',
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      }
      return
    }

    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'not_found' }))
  })

  server.listen(port, () => {
    logger.info({ port }, 'health server listening')
  })

  return server
}
