# 07 — Logging Estruturado com Winston
> ⚠️ **Dependência:** Fazer após o plano 06 (Health Check). Os planos 08 (Sentry) e 09 (Correlation ID) constroem sobre o Logger criado aqui. Modifica `main.ts` e `transform.interceptor.ts` — ver `00_ORDEM_EXECUCAO.md`.
**Prioridade:** 🔴 Crítico — fazer antes do go-live
**Tempo estimado:** 3h
**Área:** Observabilidade

---

## Problema

O sistema usa `console.log` apenas no bootstrap. Em produção, não há logs dos jobs (se falharem, ninguém sabe), das notificações (erros são silenciados), nem das queries lentas. Debugar problemas em produção é impossível.

---

## Implementação

### 1. Instalar pacotes

```bash
cd apps/backend
npm i winston nest-winston
```

### 2. Configurar no main.ts

```typescript
// apps/backend/src/main.ts
import { NestFactory } from '@nestjs/core'
import { WinstonModule } from 'nest-winston'
import { format, transports } from 'winston'

const logger = WinstonModule.createLogger({
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json(),
  ),
  transports: [
    new transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? format.json()
        : format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 10,
    }),
  ],
})

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger })
  // ...
}
```

### 3. Usar Logger em todos os services críticos

Padrão a seguir em cada service:

```typescript
import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class NomeService {
  private readonly logger = new Logger(NomeService.name)

  async metodoImportante() {
    this.logger.log('Iniciando operação X')
    try {
      // lógica
      this.logger.log(`Operação X concluída: ${resultado}`)
    } catch (err) {
      this.logger.error('Operação X falhou', err.stack)
      throw err
    }
  }
}
```

### 4. Services que precisam de Logger urgentemente

**`notifications.service.ts`** — substituir `.catch(() => undefined)`:
```typescript
private readonly logger = new Logger(NotificationsService.name)

// Antes:
.catch(() => undefined)

// Depois:
.catch((err) => this.logger.error('Push notification failed', err.stack))
.catch((err) => this.logger.error('Email delivery failed', err.stack))
```

**`executive-report.job.ts`**:
```typescript
private readonly logger = new Logger(ExecutiveReportJob.name)

@Cron('0 7 * * 1')
async sendWeeklyReport() {
  this.logger.log('Executive report job started')
  try {
    // lógica
    this.logger.log(`Executive report sent to ${users.length} users`)
  } catch (err) {
    this.logger.error('Executive report job failed', err.stack)
  }
}
```

**`impediment-escalation.job.ts`**, **`task-checkin.job.ts`**, **`group-archive.job.ts`**, **`meeting-reminder.job.ts`** — mesmo padrão.

### 5. Log de tempo de resposta das requisições

```typescript
// apps/backend/src/shared/interceptors/transform.interceptor.ts
// Adicionar ao TransformInterceptor existente:
import { Logger } from '@nestjs/common'

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest()
    const start = Date.now()

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start
        if (duration > 1000) { // Log requests lentos (> 1s)
          this.logger.warn(`SLOW ${req.method} ${req.url} — ${duration}ms`)
        }
      }),
      map((data) => ({ data, statusCode: 200, timestamp: new Date().toISOString() })),
    )
  }
}
```

### 6. Adicionar /logs ao .gitignore

```gitignore
# apps/backend/.gitignore
logs/
*.log
```

---

## Arquivos modificados
- `apps/backend/package.json` — winston, nest-winston
- `apps/backend/src/main.ts` — WinstonModule.createLogger
- `apps/backend/src/infrastructure/notifications/notifications.service.ts` — Logger + remover .catch(() => undefined)
- `apps/backend/src/infrastructure/jobs/*.job.ts` — Logger em todos os jobs
- `apps/backend/src/shared/interceptors/transform.interceptor.ts` — log de requests lentos
- `apps/backend/.gitignore` — ignorar pasta logs/
