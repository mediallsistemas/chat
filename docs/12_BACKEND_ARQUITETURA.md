# Plano 12 — Arquitetura Backend
## NestJS, módulos, guards, interceptors, DTOs

---

## Objetivo
Definir a arquitetura backend com NestJS, organização por módulos de domínio, guard stack e boas práticas.

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

## Estrutura de Pastas

```
apps/backend/src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── local.strategy.ts
│   └── dto/
│       ├── login.dto.ts
│       └── refresh-token.dto.ts
│
├── units/
│   ├── units.module.ts
│   ├── units.controller.ts
│   └── units.service.ts
│
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   └── users.service.ts
│
├── strategic/
│   ├── strategic.module.ts
│   ├── plans/
│   ├── objectives/
│   ├── goals/
│   ├── phases/                ← NOVO (etapas)
│   └── macro-tasks/
│
├── kanban/
│   ├── kanban.module.ts
│   ├── boards/
│   ├── columns/
│   └── tasks/
│
├── impediments/
│   ├── impediments.module.ts
│   ├── impediments.controller.ts
│   └── impediments.service.ts
│
├── communication/
│   ├── communication.module.ts
│   ├── groups/
│   └── messages/
│
├── meetings/
│   ├── meetings.module.ts
│   └── ...
│
├── files/
│   ├── files.module.ts
│   └── ...
│
├── notifications/
│   ├── notifications.module.ts
│   └── ...
│
├── gateway/
│   └── app.gateway.ts          ← Socket.IO WebSocket Gateway
│
├── jobs/
│   ├── jobs.module.ts
│   ├── impediment-escalation.job.ts
│   ├── group-archive.job.ts
│   ├── task-checkin.job.ts     ← check-in periódico de tarefas
│   └── deadline-alert.job.ts
│
└── shared/
    ├── guards/
    │   ├── jwt-auth.guard.ts
    │   ├── roles.guard.ts
    │   └── unit-scope.guard.ts
    ├── interceptors/
    │   ├── transform.interceptor.ts
    │   └── audit-log.interceptor.ts
    ├── decorators/
    │   ├── roles.decorator.ts
    │   ├── current-user.decorator.ts
    │   └── unit-scope.decorator.ts
    ├── dto/
    │   └── pagination.dto.ts
    └── controllers/
        └── base-unit.controller.ts
```

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

## Tipos Compartilhados (packages/types)

DTOs e interfaces usados pelo frontend e backend vivem em `packages/types`:

```typescript
// packages/types/src/strategic.ts
export interface Plan { id: string; name: string; status: PlanStatus; ... }
export interface Goal { id: string; targetValue: number; ... }

// packages/types/src/auth.ts
export interface JwtPayload { sub: string; role: UserRole; accessScope: AccessScope; units: string[] }
```

Importar no backend e frontend via:
```typescript
import type { Plan, JwtPayload } from '@mediall/types'
```

---

## Checklist de Implementação

- [x] Configurar monorepo (Turborepo + npm workspaces)
- [x] Criar `packages/types` com tipos base
- [x] Setup NestJS com todos os módulos
- [x] Configurar Prisma no NestJS
- [ ] Configurar Redis para cache e filas (ioredis instalado, mas não conectado a BullMQ)
- [x] Guard stack implementado (JwtAuthGuard → RolesGuard → UnitScopeGuard)
- [x] BaseUnitController
- [x] PaginationDto base
- [x] TransformInterceptor
- [x] AuditLogInterceptor
- [x] Socket.IO Gateway com autenticação JWT
- [x] Jobs cron configurados (ImpedimentEscalationJob, GroupArchiveJob)
- [ ] Jobs BullMQ com fila Redis (impediment-escalation usa node-cron, não BullMQ real)
- [ ] task-checkin.job.ts e deadline-alert.job.ts (não implementados)
- [x] Validação de unitId via UnitScopeGuard em todas as rotas protegidas
- [ ] Rate limiting no endpoint de login
- [x] Swagger/OpenAPI configurado (@nestjs/swagger)
