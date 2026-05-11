import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common'
import { Request } from 'express'
import { Observable } from 'rxjs'
import { map, tap } from 'rxjs/operators'

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>()
    const res = context.switchToHttp().getResponse()
    const correlationId = req.correlationId
    const start = Date.now()

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start
        if (duration > 1000) {
          this.logger.warn(`SLOW ${req.method} ${req.url} — ${duration}ms [${correlationId}]`)
        }
      }),
      map((data) => ({
        data,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString(),
        correlationId,
      })),
    )
  }
}
