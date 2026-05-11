# Plano 16 — Melhorias e Dívida Técnica
## Diagnóstico completo + plano de ação por área

> Documento gerado após auditoria completa do sistema (Maio 2026).
> Cada área tem nota atual, diagnóstico e ações concretas ordenadas por prioridade.

---

## Índice

| Área | Nota Atual | Prioridade |
|------|-----------|------------|
| [Segurança](#1-segurança) | 6.5/10 | 🔴 Crítica |
| [LGPD / Compliance](#2-lgpd--compliance) | 2.0/10 | 🔴 Crítica |
| [Observabilidade](#3-observabilidade) | 3.0/10 | 🔴 Crítica |
| [Tratamento de Erros](#4-tratamento-de-erros) | 4.0/10 | 🟠 Alta |
| [Escalabilidade](#5-escalabilidade) | 6.0/10 | 🟠 Alta |
| [Design de API](#6-design-de-api) | 6.0/10 | 🟠 Alta |
| [Performance](#7-performance) | 5.5/10 | 🟡 Média |
| [Duplicação de Código](#8-duplicação-de-código) | 6.0/10 | 🟡 Média |

---

## 1. Segurança
**Nota atual: 6.5/10 → Meta: 9.0/10**

### O que já funciona
- JWT em cookie `httpOnly` + `secure` em produção — XSS não rouba tokens
- `sameSite: lax` configurado corretamente
- bcrypt com custo 12 nos hashes de senha
- Bloqueio de conta após 5 tentativas falhas
- Isolamento por `unitId` em praticamente todas as queries
- Audit log automático em todas as mutações

### O que precisa ser corrigido

#### 🔴 Crítico — fazer antes do go-live

**1. Instalar Helmet (headers HTTP de segurança)**
```bash
cd apps/backend && npm i helmet
```
```typescript
// apps/backend/src/main.ts
import helmet from 'helmet'
app.use(helmet())
```
Sem isso: sem Content-Security-Policy, sem X-Frame-Options, sem HSTS.

**2. Instalar rate limiting**
```bash
cd apps/backend && npm i @nestjs/throttler
```
```typescript
// app.module.ts
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }])

// auth.controller.ts — mais restrito no login
@Throttle({ default: { ttl: 60_000, limit: 5 } })
@Post('login')
```

**3. Remover fallback do JWT_SECRET**
```typescript
// apps/backend/src/auth/jwt.strategy.ts
// REMOVER:
secret: process.env.JWT_SECRET || 'dev-secret'

// SUBSTITUIR POR:
secret: process.env.JWT_SECRET ?? (() => {
  throw new Error('JWT_SECRET env var is required')
})()
```

**4. Adicionar proteção CSRF**
```bash
npm i csurf
```
Ou usar padrão double-submit cookie — obrigatório com autenticação por cookie.

#### 🟠 Alta — primeira semana após go-live

**5. Adicionar guard em `users.findAll()`**
```typescript
// apps/backend/src/users/users.controller.ts
@Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
@Get()
findAll() { ... }
```
Atualmente qualquer usuário autenticado pode listar todos os e-mails da plataforma.

**6. Corrigir `escalatePending()` sem filtro de unidade**
O job de escalonamento de impedimentos processa todas as unidades sem isolamento.
Agrupar por `unitId` antes de escalar.

**7. Notificações: parar de engolir erros silenciosamente**
```typescript
// notifications.service.ts
// REMOVER:
.catch(() => undefined)

// SUBSTITUIR POR:
.catch((err) => this.logger.error('Push delivery failed', err.stack))
```

---

## 2. LGPD / Compliance
**Nota atual: 2.0/10 → Meta: 7.0/10**

> **Risco legal real.** A LGPD (Lei 13.709/2018) se aplica a dados pessoais de funcionários e de unidades de saúde. A ANPD pode multar até 2% do faturamento por infração, limitado a R$50 milhões.

### O que falta implementar

#### 🔴 Crítico — risco legal imediato

**1. Direito ao esquecimento (Art. 18 LGPD)**

Criar endpoint de anonimização de usuário:
```typescript
// users.controller.ts
@Delete(':userId/personal-data')
@Roles(UserRole.SUPER_ADMIN)
async anonymizeUser(@Param('userId') userId: string) {
  // Substitui name, email por "Usuário Removido" + hash
  // Mantém registros de audit_log mas remove PII
}
```

**2. Registro de consentimento**

Adicionar ao schema Prisma:
```prisma
model UserConsent {
  id          String   @id @default(uuid())
  userId      String
  type        String   // DATA_PROCESSING, PUSH_NOTIFICATIONS, etc.
  accepted    Boolean
  ip          String?
  userAgent   String?
  acceptedAt  DateTime @default(now())
  revokedAt   DateTime?

  user  User @relation(fields: [userId], references: [id])
  @@map("user_consents")
}
```

**3. Política de retenção de dados**

Definir e implementar por tipo de dado:
| Dado | Retenção sugerida |
|------|------------------|
| Mensagens de chat | 2 anos |
| Documentos | 5 anos (regulatório hospitalar) |
| Logs de auditoria | 5 anos |
| Notificações | 90 dias |
| Tokens de push | Até revogação |

Criar job cron semanal que apaga registros expirados conforme política.

**4. Relatório de dados pessoais (portabilidade)**

Endpoint que retorna todos os dados de um usuário em JSON:
```typescript
@Get(':userId/my-data')
async exportUserData(@Param('userId') userId: string) {
  // Retorna messages, documents, tickets, audit_logs do usuário
}
```

#### 🟡 Médio prazo

**5. Classificação de dados sensíveis**

Adicionar campo `sensitivity` em Document (`PUBLIC | INTERNAL | RESTRICTED | CONFIDENTIAL`) e restringir acesso por nível.

**6. Registro de atividades de tratamento (ROPA)**

Documento (não código) listando: quais dados são coletados, finalidade, base legal, tempo de retenção, com quem são compartilhados. Exigido pelo Art. 37 LGPD.

---

## 3. Observabilidade
**Nota atual: 3.0/10 → Meta: 8.0/10**

> Sem observabilidade, produção é uma caixa preta. Um job que falha toda segunda-feira pode passar meses despercebido.

### O que falta implementar

#### 🔴 Crítico — sem isso você está cego em produção

**1. Logging estruturado com Winston**
```bash
cd apps/backend && npm i winston nest-winston
```
```typescript
// main.ts
import { WinstonModule } from 'nest-winston'
import { format, transports } from 'winston'

const app = await NestFactory.create(AppModule, {
  logger: WinstonModule.createLogger({
    format: format.combine(format.timestamp(), format.json()),
    transports: [
      new transports.Console(),
      new transports.File({ filename: 'logs/error.log', level: 'error' }),
      new transports.File({ filename: 'logs/combined.log' }),
    ],
  }),
})
```

Adicionar `Logger` em todos os services que rodam jobs:
```typescript
private readonly logger = new Logger(NomeDoService.name)

this.logger.log(`Job executado: ${count} registros processados`)
this.logger.error('Falha no job', err.stack)
this.logger.warn(`Impedimento ${id} sem responsável definido`)
```

**2. Health check endpoint**
```bash
npm i @nestjs/terminus
```
```typescript
// health.controller.ts
@Get('/health')
@SkipThrottle()
healthCheck() {
  return this.health.check([
    () => this.db.pingCheck('database'),
    () => this.redis.checkHealth('redis'),
  ])
}
```
Necessário para: Docker healthcheck, load balancer, uptime monitor (UptimeRobot, Betterstack).

**3. Correlation ID em todas as requisições**

Cada request recebe um ID único que aparece em todos os logs relacionados:
```typescript
// common/middleware/correlation-id.middleware.ts
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] ?? randomUUID()
  res.setHeader('x-correlation-id', req.correlationId)
  next()
})
```

#### 🟠 Alta — primeira semana após go-live

**4. Rastreamento de erros (Sentry)**
```bash
npm i @sentry/nestjs
```
Captura automaticamente exceções não tratadas com stack trace, contexto do usuário e URL da requisição. Gratuito até 5.000 erros/mês.

**5. Métricas básicas**

Adicionar ao `TransformInterceptor` o log de tempo de resposta:
```typescript
const duration = Date.now() - start
this.logger.log(`${method} ${url} ${statusCode} ${duration}ms`)
```

---

## 4. Tratamento de Erros
**Nota atual: 4.0/10 → Meta: 8.0/10**

### Backend

**1. Filtro global de exceções**
```typescript
// common/filters/all-exceptions.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR

    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error'

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url}`, exception instanceof Error ? exception.stack : String(exception))
    }

    res.status(status).json({ statusCode: status, message, timestamp: new Date().toISOString() })
  }
}

// main.ts
app.useGlobalFilters(new AllExceptionsFilter())
```

**2. Mensagens de erro em inglês no backend**

Exceções como `BadRequestException('Arquivo obrigatório')` violam a convenção do projeto e quebram APIs consumidas por outros sistemas. Usar chaves padronizadas:
```typescript
throw new BadRequestException('FILE_REQUIRED')
// Frontend traduz: FILE_REQUIRED → "Arquivo obrigatório"
```

### Frontend

**3. Callbacks `onError` em todas as mutations**

```typescript
// use-tickets.ts — padrão a seguir
return useMutation({
  mutationFn: ...,
  onSuccess: () => { ... },
  onError: (err) => {
    toast.error(getErrorMessage(err)) // ou notificação inline
  },
})
```

**4. Substituir `window.location.href` no interceptor do Axios**

```typescript
// api.ts
// REMOVER:
window.location.href = '/login'

// SUBSTITUIR POR — redireciona sem hard reload:
import { redirect } from 'next/navigation'
redirect('/login')
```

**5. Utilitário de mensagem de erro**
```typescript
// lib/get-error-message.ts
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) return err.response?.data?.message ?? 'Erro inesperado'
  if (err instanceof Error) return err.message
  return 'Erro inesperado'
}
```

---

## 5. Escalabilidade
**Nota atual: 6.0/10 → Meta: 8.0/10**

### Problemas que aparecem com crescimento

**1. Socket.IO não escala horizontalmente**

Com múltiplas instâncias NestJS (Docker Swarm, Kubernetes), cada pod tem seu próprio Socket.IO. Um usuário conectado ao Pod A não recebe eventos emitidos pelo Pod B.

```bash
npm i @socket.io/redis-adapter
```
```typescript
// app.gateway.ts
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'

const pubClient = createClient({ url: process.env.REDIS_URL })
const subClient = pubClient.duplicate()
server.adapter(createAdapter(pubClient, subClient))
```

**2. Endpoints sem paginação retornam arrays ilimitados**

Endpoints afetados:
- `GET /units/:unitId/tickets` — todos os tickets da unidade
- `GET /units/:unitId/documents` — todos os documentos
- `GET /units/:unitId/messages` — todas as mensagens do grupo (já tem cursor mas sem limite padrão)
- `GET /units/:unitId/audit-logs` — todos os logs

Padrão a adotar:
```typescript
// DTO de paginação reutilizável
export class PaginationDto {
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number)
  limit?: number = 20

  @IsOptional() @IsInt() @Min(0) @Type(() => Number)
  offset?: number = 0
}

// Resposta padronizada
return { data: items, total, limit, offset, hasMore: offset + items.length < total }
```

**3. Cache em memória não funciona com múltiplos pods**

O cache de 30s do `DashboardService` usa `Map` em memória — cada pod tem seu próprio cache desatualizado.

```bash
npm i cache-manager cache-manager-redis-store
```
```typescript
// Substituir Map por Redis via CacheModule do NestJS
@Module({
  imports: [CacheModule.register({ store: redisStore, ttl: 30 })],
})
```

**4. Indexes compostos ausentes no banco**

Adicionar via migration Prisma:
```prisma
// schema.prisma
@@index([unitId, status])    // tickets
@@index([unitId, createdAt]) // impediments, audit_log
@@index([groupId, createdAt]) // messages
@@index([unitId, folderId])  // documents
```

**5. Versionamento de API**

Protege contra breaking changes quando múltiplos clientes (web, mobile futuro) consomem a API:
```typescript
// main.ts
app.enableVersioning({ type: VersioningType.URI })
// Rotas viram: /api/v1/units/:unitId/tickets
```

---

## 6. Design de API
**Nota atual: 6.0/10 → Meta: 8.5/10**

### O que melhorar

**1. Paginação consistente** (ver seção Escalabilidade #2)

**2. Códigos HTTP corretos**
```typescript
// POST deve retornar 201
@Post()
@HttpCode(HttpStatus.CREATED)
create() { ... }

// DELETE deve retornar 204
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
remove() { ... }
```

**3. Versionamento de API** (ver seção Escalabilidade #5)

**4. Schemas de resposta no Swagger**

Decorar controllers com `@ApiResponse` para documentar o que retornam:
```typescript
@ApiResponse({ status: 201, type: TicketResponseDto })
@ApiResponse({ status: 400, description: 'Dados inválidos' })
@ApiResponse({ status: 404, description: 'Recurso não encontrado' })
```

**5. Padronizar filtros de query**

Criar `TicketsQueryDto`, `DocumentsQueryDto` com validação ao invés de query params soltos:
```typescript
export class TicketsQueryDto extends PaginationDto {
  @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority
  @IsOptional() @IsString() assignedTo?: string
  @IsOptional() @IsDateString() dueBefore?: string
}
```

---

## 7. Performance
**Nota atual: 5.5/10 → Meta: 7.5/10**

### Banco de dados

**1. Adicionar indexes compostos** (ver seção Escalabilidade #4)

**2. Corrigir N+1 em `tasks.service.ts move()`**

O método `move()` faz 3+ queries sequenciais. Consolidar com `include` em uma única busca:
```typescript
// Uma query ao invés de três
const task = await this.prisma.task.findUniqueOrThrow({
  where: { id: taskId, column: { board: { unitId } } },
  include: { dependencies: { include: { dependsOn: true } } },
})
```

**3. Algoritmo de ciclo de dependências**

A detecção de ciclos usa recursão assíncrona — pode causar stack overflow com grafos profundos. Substituir por BFS iterativo:
```typescript
async hasCycle(taskId: string, targetId: string): Promise<boolean> {
  const visited = new Set<string>()
  const queue = [targetId]
  while (queue.length) {
    const current = queue.shift()!
    if (current === taskId) return true
    if (visited.has(current)) continue
    visited.add(current)
    const deps = await this.prisma.taskDependency.findMany({ where: { taskId: current } })
    queue.push(...deps.map(d => d.dependsOnId))
  }
  return false
}
```

### Frontend

**4. Substituir `react-beautiful-dnd` por `@dnd-kit/core`**

`react-beautiful-dnd` está abandonado desde 2020, sem suporte a React 18 Concurrent Mode e com issues de performance em boards grandes.
```bash
npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```
Migração necessária apenas no `kanban-board-client.tsx`.

**5. Lazy loading das views do Kanban**

```typescript
// kanban-board-client.tsx
const KanbanListView = dynamic(() => import('./kanban-list-view'), { ssr: false })
const KanbanCalendarView = dynamic(() => import('./kanban-calendar-view'), { ssr: false })
```

**6. Configurar `next.config.mjs`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@mediall/types'],
  compress: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: process.env.MINIO_HOST }],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['@tabler/icons-react'],
  },
}
```

---

## 8. Duplicação de Código
**Nota atual: 6.0/10 → Meta: 8.5/10**

### Principais duplicações

**1. Padrão de formulário modal — 15+ páginas**

Criar componente `<FormModal>` genérico:
```typescript
// components/ui/form-modal.tsx
interface FormModalProps {
  open: boolean
  onClose: () => void
  title: string
  onSubmit: () => void | Promise<void>
  isPending?: boolean
  submitLabel?: string
  children: React.ReactNode
}
```

**2. Skeleton de loading — copy-paste em todas as páginas**

```typescript
// components/ui/skeleton-list.tsx
export function SkeletonList({ count = 3, height = 'h-16' }: { count?: number; height?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${height} rounded-xl bg-gs/10 animate-pulse`} />
      ))}
    </div>
  )
}
```

**3. `formatSize()` e `fileIcon()` definidos em `documentos/page.tsx`**

Mover para `apps/frontend/src/lib/utils.ts` — são utilitários usados em múltiplos contextos (documentos, arquivos de chat, anexos de tarefas).

**4. Badges de status/prioridade duplicados**

O mapa `STATUS_STYLE`, `STATUS_LABEL`, `PRIORITY_STYLE`, `PRIORITY_LABEL` está definido em `chamados/page.tsx` mas deveria estar em `lib/ticket-utils.ts` para ser reutilizado em outros lugares que exibam tickets.

**5. Formulários: migrar de `useState` para `react-hook-form` + `zod`**

Páginas a migrar:
- `chamados/page.tsx` — formulário de criação de chamado
- `documentos/page.tsx` — formulários de pasta e upload
- `reunioes/page.tsx` — formulário de criação de reunião
- `impedimentos/page.tsx` — formulário de criação de impedimento

```typescript
// Padrão a adotar
const schema = z.object({
  title: z.string().min(3, 'Mínimo 3 caracteres'),
  priority: z.nativeEnum(TicketPriority),
})

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { priority: TicketPriority.MEDIUM },
})
```

---

## Plano de Execução

### Esta semana (go-live blocker)
| # | Ação | Tempo estimado |
|---|------|---------------|
| 1 | Instalar `helmet` + `@nestjs/throttler` | 1h |
| 2 | Remover fallback `JWT_SECRET` | 15min |
| 3 | Filtro global de exceções no NestJS | 2h |
| 4 | Health check `GET /api/health` | 1h |
| 5 | Logger estruturado nos jobs e notifications service | 2h |
| 6 | `onError` callbacks nas mutations de chamados e documentos | 2h |

### Primeira semana pós go-live
| # | Ação | Tempo estimado |
|---|------|---------------|
| 7 | Winston + logs estruturados em todos os services | 4h |
| 8 | Sentry para captura de erros em produção | 2h |
| 9 | Guard em `users.findAll()` | 30min |
| 10 | Paginação em tickets e documents endpoints | 4h |
| 11 | Indexes compostos no banco (migration) | 1h |
| 12 | Modelo `UserConsent` no Prisma (LGPD) | 2h |

### Primeiro mês pós go-live
| # | Ação | Tempo estimado |
|---|------|---------------|
| 13 | Endpoint de anonimização de usuário (LGPD Art. 18) | 4h |
| 14 | Job de retenção de dados (LGPD) | 4h |
| 15 | Redis adapter para Socket.IO (escalabilidade horizontal) | 3h |
| 16 | Versionamento de API (`/v1/`) | 3h |
| 17 | Migrar `react-beautiful-dnd` → `@dnd-kit` | 8h |
| 18 | Componentes `SkeletonList` e `FormModal` | 3h |
| 19 | Migrar formulários para `react-hook-form` + `zod` | 6h |
| 20 | CSRF protection | 3h |

---

## Score Atual vs Meta

| Área | Atual | Meta | Gap |
|------|-------|------|-----|
| Segurança | 6.5 | 9.0 | +2.5 |
| LGPD | 2.0 | 7.0 | +5.0 |
| Observabilidade | 3.0 | 8.0 | +5.0 |
| Tratamento de Erros | 4.0 | 8.0 | +4.0 |
| Escalabilidade | 6.0 | 8.0 | +2.0 |
| Design de API | 6.0 | 8.5 | +2.5 |
| Performance | 5.5 | 7.5 | +2.0 |
| Duplicação | 6.0 | 8.5 | +2.5 |
| **Média** | **4.9** | **8.0** | **+3.1** |
