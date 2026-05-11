# 08 — Rastreamento de Erros com Sentry
> ⚠️ **Dependência:** Fazer APÓS os planos 05 (Exception Filter), 07 (Winston) e 09 (Correlation ID). Este plano adiciona ao `AllExceptionsFilter` criado no 05 e usa o Logger do 07.
**Prioridade:** 🟠 Alta — primeira semana pós go-live
**Tempo estimado:** 2h
**Área:** Observabilidade

---

## Problema

Winston loga erros em arquivo local. Mas em produção, você precisa saber de um erro **imediatamente**, com contexto completo (usuário, URL, stack trace, frequência). Sentry faz isso automaticamente — gratuito até 5.000 erros/mês.

---

## Implementação

### 1. Criar conta e projeto no Sentry

1. Acessar sentry.io → criar conta gratuita
2. Criar projeto: selecionar **Node.js**
3. Copiar o `SENTRY_DSN` gerado

### 2. Instalar pacotes

```bash
# Backend
cd apps/backend
npm i @sentry/nestjs @sentry/profiling-node

# Frontend
cd apps/frontend
npm i @sentry/nextjs
```

### 3. Configurar backend

```typescript
// apps/backend/src/instrument.ts — deve ser importado ANTES de tudo
import * as Sentry from '@sentry/nestjs'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN, // Desativado se DSN não configurado
})
```

```typescript
// apps/backend/src/main.ts — importar ANTES de qualquer outro import
import './instrument'
import { NestFactory } from '@nestjs/core'
// ...
```

```typescript
// apps/backend/src/common/filters/all-exceptions.filter.ts
// Adicionar ao filtro já criado (arquivo 05):
import * as Sentry from '@sentry/nestjs'

catch(exception: unknown, host: ArgumentsHost) {
  const { status } = this.resolveException(exception)

  // Enviar ao Sentry apenas erros 5xx (não 4xx que são do cliente)
  if (status >= 500) {
    Sentry.captureException(exception, {
      extra: {
        method: req.method,
        url: req.url,
        userId: req.user?.sub,
        unitId: req.params?.unitId,
      },
    })
  }

  // ... resto do filtro
}
```

### 4. Configurar frontend

```bash
# Gera automaticamente os arquivos de configuração
npx @sentry/wizard@latest -i nextjs
```

Ou manualmente:

```typescript
// apps/frontend/sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 0.5, // Replay apenas quando há erro
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,  // Mascarar dados sensíveis
      blockAllMedia: false,
    }),
  ],
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
})
```

```typescript
// apps/frontend/sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
})
```

### 5. Adicionar variáveis de ambiente

```env
# .env.example
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx  # Para source maps
```

### 6. Identificar usuário no Sentry

```typescript
// apps/backend/src/common/middleware/sentry-user.middleware.ts
import * as Sentry from '@sentry/nestjs'

export function sentryUserMiddleware(req, res, next) {
  if (req.user) {
    Sentry.setUser({ id: req.user.sub, email: req.user.email })
  }
  next()
}
```

---

## O que o Sentry captura automaticamente

- Stack traces completos com contexto
- Frequência de cada erro (quantas vezes aconteceu, quantos usuários afetados)
- Sessão do usuário quando o erro ocorreu
- Alertas por e-mail/Slack quando erro novo aparece
- Source maps do Next.js (código original, não minificado)

---

## Arquivos criados/modificados
- `apps/backend/src/instrument.ts` — novo
- `apps/backend/src/main.ts` — import instrument.ts
- `apps/backend/src/common/filters/all-exceptions.filter.ts` — Sentry.captureException
- `apps/frontend/sentry.client.config.ts` — novo
- `apps/frontend/sentry.server.config.ts` — novo
- `.env.example` — SENTRY_DSN
