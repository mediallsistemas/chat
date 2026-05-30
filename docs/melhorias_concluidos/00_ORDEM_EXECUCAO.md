# 00 — Ordem de Execução e Mapa de Conflitos
## Guia de implementação para os 20 planos de melhoria

> **Leia este arquivo antes de implementar qualquer plano.**
> Vários planos modificam os mesmos arquivos. A ordem abaixo garante que cada plano
> constrói sobre o anterior sem conflito.

---

## Ordem Correta de Execução

```
SPRINT A — Segurança (go-live blocker)
├── 01 → 02 → 03 → 04 → 05
│   Todos modificam main.ts e arquivos de auth — fazer nessa ordem exata

SPRINT B — Observabilidade (primeira semana pós go-live)
├── 06 → 07 → 09 → 08
│   07 e 09 modificam o mesmo interceptor — 07 primeiro, depois 09 adiciona

SPRINT C — LGPD (primeira semana pós go-live)
├── 13 → 14 → 15
│   Todos modificam schema.prisma — cada um gera sua própria migration em sequência

SPRINT D — Escalabilidade e API (primeiro mês)
├── 11 → 12 → 16 → 17
│   Independentes entre si, mas 12 melhora a performance do 11

SPRINT E — Frontend (primeiro mês)
├── 10 → 19 → 20 → 18
│   10 cria hooks de erro que 19 e 20 consomem; 18 é totalmente independente
```

---

## Mapa de Conflitos

Arquivos modificados por múltiplos planos — devem ser editados **na ordem indicada**:

### `apps/backend/src/main.ts`
Modificado por: 01, 02, 03, 05, 06, 07, 08, 17

| Ordem | Plano | O que adiciona ao main.ts |
|-------|-------|--------------------------|
| 1º | 01 | `app.use(helmet())` + ThrottlerModule |
| 2º | 02 | validação de env vars no bootstrap |
| 3º | 03 | `app.use(cookieParser())` + `doubleCsrfProtection` |
| 4º | 05 | `app.useGlobalFilters(new AllExceptionsFilter())` |
| 5º | 06 | HealthModule no AppModule (não main.ts diretamente) |
| 6º | 07 | `WinstonModule.createLogger(...)` como segundo argumento do NestFactory |
| 7º | 08 | `import './instrument'` na primeira linha |
| 8º | 17 | `app.enableVersioning(...)` |

**Estado final do main.ts após todos os planos:**
```typescript
import './instrument'                          // 08 — primeiro import
import { NestFactory } from '@nestjs/core'
import { WinstonModule } from 'nest-winston'  // 07
import { VersioningType } from '@nestjs/common' // 17
import helmet from 'helmet'                   // 01
import cookieParser from 'cookie-parser'      // 03
import { doubleCsrf } from 'csrf-csrf'        // 03
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter' // 05
import { AppModule } from './app.module'

const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DATABASE_URL', 'REDIS_HOST', ...] // 02

async function bootstrap() {
  const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k])
  if (missing.length) { console.error('Missing env:', missing); process.exit(1) } // 02

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({ ... }),  // 07
  })

  app.use(helmet({ ... }))                        // 01
  app.use(cookieParser())                         // 03
  app.use(doubleCsrfProtection)                   // 03
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' }) // 17
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ ... }))
  app.useGlobalFilters(new AllExceptionsFilter()) // 05
  app.enableCors({ ... })

  // Swagger...
  await app.listen(port)
}
bootstrap()
```

---

### `apps/backend/src/app.module.ts`
Modificado por: 01, 06, 09

| Ordem | Plano | O que adiciona |
|-------|-------|----------------|
| 1º | 01 | `ThrottlerModule.forRoot(...)` em imports + `ThrottlerGuard` em providers |
| 2º | 06 | `HealthModule` em imports |
| 3º | 09 | `implements NestModule` + `configure(consumer)` com `CorrelationIdMiddleware` |

---

### `apps/backend/src/contexts/auth/auth.controller.ts`
Modificado por: 01, 03, 04

| Ordem | Plano | O que adiciona |
|-------|-------|----------------|
| 1º | 01 | `@Throttle(...)` no endpoint `@Post('login')` |
| 2º | 03 | `@Get('csrf-token')` — endpoint para buscar token CSRF |
| 3º | 04 | `@Get('me')` e `@Patch('me')` — perfil do usuário autenticado |

---

### `apps/backend/src/contexts/users/users.controller.ts`
Modificado por: 04, 14

| Ordem | Plano | O que adiciona |
|-------|-------|----------------|
| 1º | 04 | Guards de role em findAll/findOne/create/delete + endpoint search |
| 2º | 14 | `@Delete(':userId/personal-data')` (anonimização) + `@Get(':userId/my-data')` (portabilidade) |

---

### `apps/backend/src/shared/interceptors/transform.interceptor.ts`
Modificado por: 07, 09

| Ordem | Plano | O que adiciona |
|-------|-------|----------------|
| 1º | 07 | `private readonly logger` + log de requests lentos (> 1s) |
| 2º | 09 | log inclui `correlationId` + `correlationId` na resposta JSON |

**Fazer 07 antes de 09.** O plano 09 adiciona ao Logger criado no 07.

---

### `apps/backend/src/shared/filters/all-exceptions.filter.ts`
Modificado por: 05, 08, 09

| Ordem | Plano | O que adiciona |
|-------|-------|----------------|
| 1º | 05 | Cria o arquivo completo |
| 2º | 08 | Adiciona `Sentry.captureException(...)` para erros 5xx |
| 3º | 09 | Adiciona `correlationId` no log e na resposta JSON |

**05 deve ser feito primeiro** — 08 e 09 dependem do arquivo existir.

---

### `apps/backend/prisma/schema.prisma`
Modificado por: 12, 13, 15

| Ordem | Plano | O que adiciona | Migration |
|-------|-------|----------------|-----------|
| 1º | 12 | Indexes compostos (`@@index`) em Ticket, Document, Message, etc. | `add_composite_indexes` |
| 2º | 13 | Enum `ConsentType` + modelo `UserConsent` | `add_user_consent` |
| 3º | 15 | Campo `expiresAt` em `Notification` | `add_notification_expires_at` |

**Cada migration deve ser executada individualmente e em ordem:**
```bash
# Após editar o schema para o plano 12:
npx prisma migrate dev --name add_composite_indexes

# Após editar para o plano 13:
npx prisma migrate dev --name add_user_consent

# Após editar para o plano 15:
npx prisma migrate dev --name add_notification_expires_at
```

---

### `apps/backend/src/infrastructure/notifications/notifications.service.ts`
Modificado por: 07, 13

| Ordem | Plano | O que adiciona |
|-------|-------|----------------|
| 1º | 07 | `private readonly logger` + substituir `.catch(() => undefined)` por `logger.error` |
| 2º | 13 | Verificação de consentimento antes de enviar push/email |

**Fazer 07 antes de 13.** O plano 13 assume que o logger já existe para logar erros de consentimento.

---

### `apps/frontend/src/lib/api.ts`
Modificado por: 03, 09

| Ordem | Plano | O que adiciona |
|-------|-------|----------------|
| 1º | 03 | Interceptor de request que busca e envia `x-csrf-token` |
| 2º | 09 | Interceptor de request que gera e envia `x-correlation-id` |

**Os dois interceptors de request coexistem** — o de CSRF adiciona o token CSRF, o de Correlation ID adiciona o ID de rastreamento. Podem ser encadeados no mesmo interceptor ou separados.

**Estado final do api.ts após 03 e 09:**
```typescript
import axios from 'axios'
import { randomUUID } from 'crypto'

let csrfToken: string | null = null

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  const res = await axios.get('/api/v1/auth/csrf-token', { withCredentials: true })
  csrfToken = res.data.csrfToken
  return csrfToken
}

export const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api/v1`, // 17 muda a URL
  withCredentials: true,
})

// Request interceptors
api.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase()

  // 09 — Correlation ID
  config.headers['x-correlation-id'] = randomUUID()

  // 03 — CSRF token em mutações
  if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    config.headers['x-csrf-token'] = await getCsrfToken()
  }

  return config
})

// Response interceptors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 03 — renovar CSRF token se expirado
    if (error.response?.status === 403 && error.response?.data?.message === 'invalid csrf token') {
      csrfToken = null
      const newToken = await getCsrfToken()
      error.config.headers['x-csrf-token'] = newToken
      return api.request(error.config)
    }

    // 09 — logar correlationId de erros
    const correlationId = error.response?.data?.correlationId
    if (error.response?.status >= 500 && correlationId) {
      console.error(`Error [${correlationId}]:`, error.message)
    }

    // Original — redirect em 401
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/')) {
      window.location.href = '/login'
    }

    return Promise.reject(error)
  },
)
```

---

### Páginas frontend (chamados, documentos, impedimentos, reunioes)
Modificado por: 10, 19, 20

| Ordem | Plano | O que modifica nas páginas |
|-------|-------|---------------------------|
| 1º | 10 | `onError` nos hooks (use-tickets.ts, etc.) — não edita as páginas diretamente |
| 2º | 19 | Substitui `useState` por `react-hook-form` + `zod` nos formulários |
| 3º | 20 | Substitui padrões de loading/empty state por componentes compartilhados |

**Não há conflito real** — cada plano edita seções diferentes das páginas:
- 10 edita os hooks (arquivos `use-*.ts`)
- 19 edita o bloco de formulário dentro do Modal
- 20 edita os blocos de loading skeleton e empty state

**Fazer nessa ordem** para evitar re-trabalho (20 assume que os formulários já estão com react-hook-form do 19).

---

### `apps/frontend/src/components/ui/index.ts`
Modificado por: 10, 19, 20

Cada plano adiciona novos exports. Fazer em ordem:
- 10 adiciona: `toast-container`
- 19 adiciona: `form-field`
- 20 adiciona: `skeleton-list`, `empty-state`, `status-badge`

---

### `docker-compose.yml`
Modificado por: 06, 16

| Ordem | Plano | O que adiciona |
|-------|-------|----------------|
| 1º | 06 | `healthcheck` no serviço nestjs |
| 2º | 16 | `appendonly yes` no serviço redis + `healthcheck` no redis + `depends_on` no nestjs |

---

## Dependências Explícitas

```
05 (Exception Filter)   → deve existir antes de → 08 (Sentry)
05 (Exception Filter)   → deve existir antes de → 09 (Correlation ID)
07 (Winston)            → deve existir antes de → 09 (Correlation ID)
07 (Winston)            → deve existir antes de → 08 (Sentry)
07 (Winston)            → deve existir antes de → 13 (LGPD Consents)
13 (LGPD Consents)      → deve existir antes de → 14 (Anonymization)
13 (LGPD Consents)      → deve existir antes de → 15 (Data Retention)
04 (Users Role Guard)   → deve existir antes de → 14 (Anonymization)
10 (onError Mutations)  → deve existir antes de → 19 (react-hook-form)
19 (react-hook-form)    → deve existir antes de → 20 (Shared Components)
17 (API Versioning)     → atualiza baseURL do api.ts — fazer depois de 03 e 09
```

---

## Checklist de Execução

### Sprint A — Segurança
- [x] 01 — Helmet + Rate Limiting
- [x] 02 — JWT Secret Hardening
- [x] 03 — CSRF Protection
- [x] 04 — Users Role Guard
- [x] 05 — Global Exception Filter

### Sprint B — Observabilidade
- [x] 06 — Health Check
- [x] 07 — Winston Logging
- [x] 09 — Correlation ID *(depende de 07)*
- [x] 08 — Sentry *(depende de 05, 07, 09)*

### Sprint C — LGPD
- [x] 13 — User Consent Model
- [x] 14 — Anonymization *(depende de 13 e 04)*
- [x] 15 — Data Retention *(depende de 13)*

### Sprint D — Escalabilidade
- [x] 11 — Pagination API
- [x] 12 — Database Indexes
- [x] 16 — Socket Redis Adapter
- [x] 17 — API Versioning *(atualiza api.ts — fazer depois de 03 e 09)*

### Sprint E — Frontend
- [x] 10 — onError Mutations
- [x] 19 — react-hook-form Migration *(depende de 10)*
- [x] 20 — Shared Components *(depende de 19)*
- [x] 18 — dnd-kit Migration *(independente — pode ser feito a qualquer momento)*
