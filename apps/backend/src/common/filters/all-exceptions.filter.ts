import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import * as Sentry from '@sentry/nestjs'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    const { status, message } = this.resolveException(exception)

    const correlationId = req.correlationId

    if (status >= 500) {
      Sentry.captureException(exception, {
        extra: { method: req.method, url: req.url, correlationId, userId: (req as any).user?.sub },
      })
      this.logger.error(
        `${req.method} ${req.url} → ${status} [${correlationId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    } else if (status >= 400) {
      this.logger.warn(`${req.method} ${req.url} → ${status}: ${message} [${correlationId}]`)
    }

    res.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
      correlationId,
    })
  }

  private resolveException(exception: unknown): { status: number; message: string } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse()
      const message =
        typeof response === 'string'
          ? response
          : (response as { message?: string | string[] }).message
      return {
        status: exception.getStatus(),
        message: Array.isArray(message) ? message.join(', ') : (message ?? exception.message),
      }
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return { status: HttpStatus.CONFLICT, message: 'Resource already exists' }
      if (exception.code === 'P2025') return { status: HttpStatus.NOT_FOUND, message: 'Resource not found' }
      return { status: HttpStatus.BAD_REQUEST, message: 'Database operation failed' }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid data provided' }
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' }
  }
}
