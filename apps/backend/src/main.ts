import './instrument'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { WinstonModule } from 'nest-winston'
import { format, transports } from 'winston'
import cookieParser = require('cookie-parser')
import helmet from 'helmet'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter'
import { doubleCsrfProtection } from './csrf'

const REQUIRED_ENV_VARS = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'REDIS_HOST', 'MINIO_ENDPOINT', 'CSRF_SECRET']

// Billing (plano 26) is opt-in. When enabled, its secrets are required at boot —
// no insecure fallback (security.md §2). When off (dev default), the app boots
// without Stripe keys and the webhook/checkout endpoints return 503.
if (process.env.BILLING_ENABLED === 'true') {
  REQUIRED_ENV_VARS.push('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET')
}

// Stripe verifies the webhook against the raw request bytes — this path must skip
// the CSRF middleware (Stripe sends no CSRF token) and keep its raw body.
const STRIPE_WEBHOOK_PATH = '/api/v1/platform/billing/webhook'

const logger = WinstonModule.createLogger({
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json(),
  ),
  transports: [
    new transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? format.json()
          : format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 10 * 1024 * 1024, maxFiles: 5 }),
    new transports.File({ filename: 'logs/combined.log', maxsize: 20 * 1024 * 1024, maxFiles: 10 }),
  ],
})

async function bootstrap() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }

  const app = await NestFactory.create(AppModule, { logger, rawBody: true })

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }))
  app.use(cookieParser())
  app.use((req: any, res: any, next: any) => {
    if (req.path === STRIPE_WEBHOOK_PATH) return next() // Stripe webhook: no CSRF
    return doubleCsrfProtection(req, res, next)
  })
  // csrf-csrf throws an http-errors ForbiddenError outside Nest's pipeline,
  // which would land in Express's default 500 handler. Convert it to a clean
  // 403 JSON so the frontend can react (re-fetch token + retry).
  app.use((err: any, _req: any, res: any, next: any) => {
    if (err && (err.code === 'EBADCSRFTOKEN' || err.statusCode === 403)) {
      return res.status(403).json({
        statusCode: 403,
        message: 'Invalid or missing CSRF token',
        code: err.code ?? 'EBADCSRFTOKEN',
      })
    }
    next(err)
  })
  app.setGlobalPrefix('api')
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })

  app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })

  const config = new DocumentBuilder()
    .setTitle('Mediall API')
    .setDescription(
      'API da plataforma corporativa Mediall Brasil — gestão estratégica, Kanban, chat, reuniões e muito mais. ' +
      'Autenticação via cookie HttpOnly (access_token). Faça login em /api/auth/login para obter o cookie.',
    )
    .setVersion('1.0')
    .setContact('Mediall Brasil', '', 'mediallsistemas@gmail.com')
    .addTag('auth', 'Autenticação e sessão')
    .addTag('users', 'Gestão de usuários')
    .addTag('units', 'Unidades hospitalares')
    .addTag('strategic', 'Planos, objetivos, metas e etapas')
    .addTag('kanban', 'Boards, tarefas e Kanban')
    .addTag('impediments', 'Impedimentos e escalação')
    .addTag('chat', 'Grupos e mensagens em tempo real')
    .addTag('meetings', 'Reuniões e videochamadas')
    .addTag('notifications', 'Notificações in-app, push e email')
    .addTag('reports', 'Exportação de relatórios PDF/Excel')
    .addTag('audit', 'Logs de auditoria')
    .addTag('billing', 'Assinatura do tenant (plano, faturas, upgrade)')
    .addTag('platform', 'Administração da plataforma (dono do SaaS)')
    .addCookieAuth('access_token')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  })

  const port = process.env.BACKEND_PORT || 4000
  await app.listen(port)
  console.log(`Backend running on http://localhost:${port}`)
  console.log(`Swagger docs at http://localhost:${port}/api/v1/docs`)
}

bootstrap()
