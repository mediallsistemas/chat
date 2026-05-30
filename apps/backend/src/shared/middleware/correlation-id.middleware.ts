import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

declare global {
  namespace Express {
    interface Request {
      correlationId: string
    }
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    req.correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID()
    res.setHeader('x-correlation-id', req.correlationId)
    next()
  }
}
