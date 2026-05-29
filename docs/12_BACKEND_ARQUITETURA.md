# Plano 12 — Arquitetura Backend
## NestJS DDD, módulos, guards, interceptors, DTOs

> Última revisão: 2026-05-23 — alinhado à reestruturação DDD concluída e ao plano 17 (Modular Monolith).

---

## Objetivo
Definir a arquitetura backend com NestJS em **DDD modular** (4 camadas por contexto), guard stack, comunicação entre contextos via EventBus e boas práticas.

---

## Convenções de Nomenclatura

- **Funções e métodos**: inglês — `createUser()`, `findAllPlans()`, `deleteGoal()`
- **Classes e módulos**: inglês — `UsersService`, `AuthGuard`, `StrategicPlanModule`
- **DTOs e interfaces**: inglês — `CreatePlanDto`, `UpdateGoalDto`, `JwtPayload`
- **Variáveis e parâmetros**: inglês — `unitId`, `userId`, `payload`
- **Rotas REST**: inglês — `/api/plans`, `/api/users/:id`
- **Comentários no código**: inglês
- **Mensagens retornadas ao usuário (erros, respostas)**: português

---

## Localização no Monorepo

```
mediall/
└── apps/
    └── backend/        ← raiz deste app
        ├── src/
        ├── prisma/
        │   └── schema.prisma
        └── package.json
```

---

## Estrutura de Pastas (DDD Modular)

Três grandes blocos no topo: **`contexts/`**, **`shared/`**, **`infrastructure/`**.

```
apps/backend/src/
├── contexts/                  ← 15 domínios de negócio (DDD 4 camadas cada)
│   ├── auth/
│   ├── users/
│   ├── units/
│   ├── strategic/             ← plans, objectives, goals, phases, macro-tasks
│   ├── kanban/                ← boards, columns, tasks, task-files
│   ├── chat/                  ← groups, members, messages, presence
│   ├── meetings/
│   ├── transcription/
│   ├── documents/
│   ├── tickets/
│   ├── impediments/
│   ├── notifications/
│   ├── consents/
│   ├── audit/
│   ├── dashboard/
│   └── reports/
│
├── shared/                    ← cross-cutting técnico
│   ├── guards/                ← jwt-auth, roles, unit-scope
│   ├── interceptors/          ← transform, audit-log
│   ├── decorators/            ← roles, current-user, unit-scope
│   ├── filters/               ← all-exceptions, http-exception
│   ├── middleware/            ← correlation-id
│   ├── events/                ← EventBusService (EventEmitter2 @Global)
│   ├── controllers/           ← base-unit.controller.ts
│   ├── dto/                   ← pagination.dto.ts
│   └── utils/
│
└── infrastructure/            ← integrações externas, sem regra de negócio
    ├── prisma/                ← PrismaService, módulo Prisma
    ├── gateway/               ← Socket.IO + RealtimeEventHandler
    ├── storage/               ← MinIO/S3 client
    ├── mail/                  ← envio de e-mail
    ├── push/                  ← web push
    ├── jobs/                  ← BullMQ + node-cron
    └── health/                ← terminus health checks
```

### Estrutura interna de cada contexto

```
contexts/<domain>/
├── domain/                    ← eventos de domínio (DomainEvent subclasses), entidades puras
├── application/               ← services (facade chamado pelos controllers), handlers de eventos
├── infrastructure/            ← repositories Prisma, integrações específicas do contexto
├── presentation/              ← controllers + DTOs de entrada/saída
└── <domain>.module.ts
```

### Regras de dependência (impostas por boundary lint — ver plano 17)

- `presentation` → `application` → `domain`
- `infrastructure` implementa portas declaradas em `domain`/`application`
- **Nenhum contexto importa diretamente de outro contexto.** Comunicação cross-domain é via:
  - `EventBus` (eventos de domínio publicados em `application`, consumidos por handlers de outro contexto em `application/handlers/`)
  - Read models públicos expostos como ports/interfaces (ex: `UsersReadPort`)
- `infrastructure/` global não contém lógica de negócio
- `shared/` é importável por todos, mas não importa de nenhum contexto

---

## Guard Stack

```typescript
// Aplicado globalmente via APP_GUARD
JwtAuthGuard → RolesGuard → UnitScopeGuard
```

### UnitScopeGuard

```typescript
@Injectable()
export class UnitScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    const unitId = request.params.unitId

    if (!unitId) return true                          // rota sem unidade
    if (user.accessScope === 'GLOBAL') return true    // acesso global
    return user.units.includes(unitId)                // verifica na lista
  }
}
```

---

## BaseUnitController

```typescript
@Controller('units/:unitId')
@UseGuards(JwtAuthGuard, RolesGuard, UnitScopeGuard)
export abstract class BaseUnitController {
  // Toda rota que herda este controller já tem:
  // 1. JWT validado
  // 2. Role verificado
  // 3. Acesso à unidade validado
}

// Uso:
@Controller()
export class TasksController extends BaseUnitController {
  @Get('tasks')
  @Roles(UserRole.COLABORADOR)
  findAll(@Param('unitId') unitId: string, @CurrentUser() user: JwtPayload) {
    return this.tasksService.findAll(unitId, user)
  }
}
```

---

## PaginationDto Base

```typescript
export class PaginationDto {
  @IsOptional() @IsInt() @Min(1)
  page?: number = 1

  @IsOptional() @IsInt() @Min(1) @Max(200)
  limit?: number = 50

  @IsOptional() @IsDateString()
  startDate?: string

  @IsOptional() @IsDateString()
  endDate?: string

  @IsOptional() @IsString()
  search?: string
}
```

---

## TransformInterceptor

```typescript
// Toda resposta da API tem este formato:
{
  data: T,
  statusCode: number,
  timestamp: string
}
```

---

## AuditLogInterceptor

Registra automaticamente na tabela `audit_log`:
- POST, PUT, PATCH, DELETE
- user_id, unit_id, action, entity, IP

---

## Jobs (BullMQ + node-cron)

| Job | Gatilho | O que faz |
|-----|---------|-----------|
| `impediment-escalation` | Diário 8h | Escala impedimentos sem resolução |
| `group-archive` | Diário 23:55 | Arquiva grupos temporários no prazo |
| `task-checkin` | Configurável | Notifica responsáveis sem atualização |
| `deadline-alert` | Diário 7h | Alerta tarefas com prazo em 48h |
| `phase-unlock` | On-demand | Desbloqueia próxima etapa ao concluir |

---

## Rotas Principais

```
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh

GET    /api/units
POST   /api/units
GET    /api/units/:unitId/plans
POST   /api/units/:unitId/plans
GET    /api/units/:unitId/plans/:planId/objectives
POST   /api/units/:unitId/plans/:planId/objectives
GET    /api/units/:unitId/goals/:goalId/phases
POST   /api/units/:unitId/goals/:goalId/phases
PATCH  /api/units/:unitId/phases/:phaseId/complete   ← concluir etapa
GET    /api/units/:unitId/kanban/:boardId
POST   /api/units/:unitId/tasks
PATCH  /api/units/:unitId/tasks/:taskId/move         ← mover Kanban
POST   /api/units/:unitId/tasks/:taskId/impediments
PATCH  /api/units/:unitId/impediments/:id/resolve
GET    /api/units/:unitId/groups
POST   /api/units/:unitId/groups
GET    /api/units/:unitId/groups/:groupId/messages
POST   /api/units/:unitId/meetings
GET    /api/dashboard                                ← painel diretoria (GLOBAL)
```

---

## Comunicação entre contextos — EventBus

`EventBusService` (em `shared/events/`) registra-se como `@Global()` e é o ÚNICO canal de comunicação assíncrona entre contextos.

```typescript
// publish — em contexts/chat/application/messages.service.ts
this.eventBus.publish(new MessagePosted({ messageId, groupId, senderId, unitId }))

// subscribe — em contexts/notifications/application/handlers/chat-notification.handler.ts
@OnEvent('chat.message.posted')
async onMessagePosted(event: MessagePosted) {
  await this.notificationsService.createForGroupMembers(...)
}
```

**Regras:**
- Eventos vivem em `contexts/<domain>/domain/events/`
- Handlers vivem no contexto **consumidor** (ex: notification handler para evento de chat fica em `contexts/notifications/application/handlers/`)
- Operações críticas de mesma transação não usam evento — usam chamadas síncronas dentro do mesmo contexto
- Para tráfego pesado/futura extração de serviço, ver plano 17 (Redis Streams)

---

## Pacotes compartilhados

```
packages/
├── types/                     ← DTOs e interfaces TS (já existe)
├── contracts/                 ← (planejado, plano 17) ports cross-service
└── events/                    ← (planejado, plano 17) schemas Zod de eventos versionados
```

Exemplo `packages/types`:
```typescript
// packages/types/src/strategic.ts
export interface Plan { id: string; name: string; status: PlanStatus; ... }
export interface Goal { id: string; targetValue: number; ... }

// packages/types/src/auth.ts
export interface JwtPayload { sub: string; role: UserRole; accessScope: AccessScope; units: string[] }
```

Importar:
```typescript
import type { Plan, JwtPayload } from '@mediall/types'
```

---

## Checklist de Implementação

### Já implementado
- [x] Monorepo (Turborepo + npm workspaces)
- [x] `packages/types` com tipos base
- [x] Setup NestJS com módulos por contexto
- [x] Prisma configurado em `infrastructure/prisma/`
- [x] Reestruturação DDD: 15 contextos com 4 camadas (`domain/application/infrastructure/presentation/`)
- [x] Guard stack (JwtAuthGuard → RolesGuard → UnitScopeGuard)
- [x] BaseUnitController em `shared/controllers/`
- [x] PaginationDto base em `shared/dto/`
- [x] TransformInterceptor + AuditLogInterceptor
- [x] Socket.IO Gateway com autenticação JWT (`infrastructure/gateway/`)
- [x] Validação de unitId via UnitScopeGuard em todas as rotas protegidas
- [x] Swagger/OpenAPI configurado
- [x] Rate limiting (@nestjs/throttler) e Helmet
- [x] Health check (terminus)
- [x] Sentry + Winston + correlation-id middleware

### Concluído — arquitetural (plano 17)
- [x] **EventBus em uso** — publishers em chat, impediments, meetings, strategic, tickets, transcription, jobs; handler `NotifyUserRequestedHandler` consome
- [x] **Boundary lint no CI** — dependency-cruiser com regras em `.dependency-cruiser.cjs`, integrado em `npm run lint`
- [x] **Schema Prisma multi-file** por domínio (`prismaSchemaFolder` em `prisma/schema/`)
- [x] **Read models cross-domain** — `CONSENT_READ_PORT`, `USERS_READ_PORT`, `UNITS_READ_PORT` em `shared/ports/`
- [x] Extrair `transcription` como serviço separado — `apps/transcription-svc/` via Redis Streams (feature flag `TRANSCRIPTION_SVC_ENABLED`)

### Concluído — outras dívidas (plano 16)
- [x] `task-checkin.job.ts` implementado (cron 9h diário, publica `NotifyUserRequested` via EventBus)

### Pendente — não-bloqueante (escopo menor)
- [ ] BullMQ real (hoje impediment-escalation usa @nestjs/schedule cron — funciona, mas BullMQ daria retry/dashboard)
- [ ] `deadline-alert.job.ts` separado (hoje a função similar está coberta por TaskCheckinJob + NotificationType.TASK_DUE_SOON nos handlers)
