# 09 — Correlation ID por Requisição
> ⚠️ **Dependência:** Fazer APÓS os planos 05 (Exception Filter) e 07 (Winston). Modifica `transform.interceptor.ts` (criado no 07) e `all-exceptions.filter.ts` (criado no 05). Também modifica `api.ts` — ver `00_ORDEM_EXECUCAO.md` para o estado final.
**Prioridade:** 🟠 Alta
**Tempo estimado:** 1.5h
**Área:** Observabilidade

---

## Problema

Quando há múltiplas requisições simultâneas, os logs ficam misturados. Não é possível saber quais logs pertencem a qual requisição. Um `correlationId` único por request resolve isso — você busca o ID no Sentry e vê todos os logs daquela requisição específica.

---

## Implementação

### 1. Criar middleware de Correlation ID

```typescript
// apps/backend/src/shared/middleware/correlation-id.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

// Extensão do tipo Request para incluir correlationId
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
    // Aceitar correlation ID do cliente (útil para rastrear do frontend ao backend)
    // ou gerar um novo
    req.correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID()

    // Enviar de volta na resposta para o frontend poder logar também
    res.setHeader('x-correlation-id', req.correlationId)

    next()
  }
}
```

### 2. Registrar no AppModule

```typescript
// apps/backend/src/app.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware'

@Module({ ... })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*')
  }
}
```

### 3. Incluir nos logs

```typescript
// apps/backend/src/shared/interceptors/transform.interceptor.ts
import { Logger } from '@nestjs/common'

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>()
    const correlationId = req.correlationId
    const start = Date.now()

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start
        this.logger.log(
          `${req.method} ${req.url} ${duration}ms`,
          { correlationId, userId: req.user?.sub },
        )
      }),
      map((data) => ({
        data,
        statusCode: 200,
        timestamp: new Date().toISOString(),
        correlationId, // Incluir na resposta para o frontend logar
      })),
    )
  }
}
```

### 4. Incluir no filtro de exceções

```typescript
// apps/backend/src/shared/filters/all-exceptions.filter.ts
catch(exception: unknown, host: ArgumentsHost) {
  const req = ctx.getRequest<Request>()

  this.logger.error(
    `${req.method} ${req.url} → ${status}`,
    { correlationId: req.correlationId, stack: exception?.stack },
  )

  res.status(status).json({
    statusCode: status,
    message,
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId, // Retornar ao cliente para suporte
  })
}
```

### 5. Frontend — enviar e logar o correlation ID

```typescript
// apps/frontend/src/lib/api.ts
import { randomUUID } from 'crypto' // ou usar Math.random() no browser

api.interceptors.request.use((config) => {
  // Gerar correlation ID no frontend e enviar para o backend
  config.headers['x-correlation-id'] = randomUUID()
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const correlationId = error.response?.data?.correlationId
    // Quando reportar erro ao suporte, incluir o correlationId
    if (error.response?.status >= 500) {
      console.error(`Error [${correlationId}]:`, error.message)
    }
    return Promise.reject(error)
  },
)
```

---

## Como usar em produção

Quando um usuário reporta problema:
1. Pedir o `correlationId` que aparece na mensagem de erro
2. Buscar no Sentry: `correlationId:abc-123`
3. Ver todos os logs daquela requisição específica

---

## Arquivos criados/modificados
- `apps/backend/src/shared/middleware/correlation-id.middleware.ts` — novo
- `apps/backend/src/app.module.ts` — registrar middleware
- `apps/backend/src/shared/interceptors/transform.interceptor.ts` — incluir correlationId no log
- `apps/backend/src/shared/filters/all-exceptions.filter.ts` — incluir correlationId no log e resposta
- `apps/frontend/src/lib/api.ts` — enviar x-correlation-id no header
