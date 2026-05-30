# 05 — Filtro Global de Exceções
> ⚠️ **Dependência:** Fazer após 01, 02, 03, 04. Os planos 08 (Sentry) e 09 (Correlation ID) dependem deste arquivo existir — não pule este plano.
**Prioridade:** 🔴 Crítico — fazer antes do go-live
**Tempo estimado:** 2h
**Área:** Tratamento de Erros + Segurança

---

## Problema

Sem filtro global, exceções não tratadas retornam a stack trace do NestJS em produção — vaza informação interna (caminhos de arquivo, nomes de variáveis, versão do framework). Além disso, erros 500 não são logados de forma centralizada.

---

## Implementação

### 1. Criar o filtro

```typescript
// apps/backend/src/shared/filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    const { status, message } = this.resolveException(exception)

    // Log interno completo — nunca exposto ao cliente
    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    } else if (status >= 400) {
      this.logger.warn(`${req.method} ${req.url} → ${status}: ${message}`)
    }

    res.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
    })
  }

  private resolveException(exception: unknown): { status: number; message: string } {
    // Exceções NestJS padrão (NotFoundException, ForbiddenException, etc.)
    if (exception instanceof HttpException) {
      const response = exception.getResponse()
      const message = typeof response === 'string'
        ? response
        : (response as { message?: string | string[] }).message
      return {
        status: exception.getStatus(),
        message: Array.isArray(message) ? message.join(', ') : (message ?? exception.message),
      }
    }

    // Erros do Prisma — não vazar detalhes do banco
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { status: HttpStatus.CONFLICT, message: 'Resource already exists' }
      }
      if (exception.code === 'P2025') {
        return { status: HttpStatus.NOT_FOUND, message: 'Resource not found' }
      }
      return { status: HttpStatus.BAD_REQUEST, message: 'Database operation failed' }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid data provided' }
    }

    // Qualquer outro erro — 500 genérico
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' }
  }
}
```

### 2. Registrar globalmente no main.ts

```typescript
// apps/backend/src/main.ts
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  // ...
  app.useGlobalFilters(new AllExceptionsFilter())
  // ...
}
```

### 3. Criar pasta common se não existir

```
apps/backend/src/common/
├── decorators/
│   ├── get-user.decorator.ts
│   ├── public.decorator.ts
│   └── roles.decorator.ts
├── filters/
│   └── all-exceptions.filter.ts   ← novo
├── guards/
│   ├── jwt-auth.guard.ts
│   ├── roles.guard.ts
│   └── unit-scope.guard.ts
└── interceptors/
    ├── audit-log.interceptor.ts
    └── transform.interceptor.ts
```

### 4. Garantir que erros Prisma não chegam ao cliente

Testar que ao forçar um erro de registro não encontrado:
```bash
curl http://localhost:4000/api/units/id-inexistente/tickets
# Deve retornar: { statusCode: 404, message: "Resource not found" }
# NÃO deve retornar: stack trace ou mensagem do Prisma
```

---

## Arquivos criados/modificados
- `apps/backend/src/shared/filters/all-exceptions.filter.ts` — novo arquivo
- `apps/backend/src/main.ts` — registrar app.useGlobalFilters()
