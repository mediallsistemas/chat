import pino from 'pino'
import { config } from './config'

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'transcription-svc', pid: process.pid },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})
