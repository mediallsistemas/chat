import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { PrismaService } from '../../prisma/prisma.service'

const AUDITED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest()

    if (!AUDITED_METHODS.includes(request.method)) return next.handle()

    const user = request.user
    if (!user) return next.handle()

    return next.handle().pipe(
      tap(async () => {
        try {
          await this.prisma.auditLog.create({
            data: {
              userId: user.sub,
              unitId: request.params?.unitId ?? null,
              action: `${request.method} ${request.path}`,
              ipAddress: request.ip || '0.0.0.0',
            },
          })
        } catch {
          // audit failures must never break the request
        }
      }),
    )
  }
}
