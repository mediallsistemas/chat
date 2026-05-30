import { z } from 'zod'

const ConfigSchema = z.object({
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  MONOLITH_INTERNAL_URL: z.string().url().default('http://nestjs:4000'),
  MONOLITH_INTERNAL_TOKEN: z.string().optional().default(''),
  CONSUMER_NAME: z.string().default(`transcription-${process.pid}`),
  POLL_BLOCK_MS: z.coerce.number().default(5000),
  MAX_RETRIES: z.coerce.number().default(3),
  HEALTH_PORT: z.coerce.number().default(4001),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
})

export type Config = z.infer<typeof ConfigSchema>

export const config: Config = ConfigSchema.parse(process.env)
