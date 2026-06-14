# Regras de Arquitetura — Backend (NestJS) e Monorepo

Arquitetura vigente: **Modular Monolith** com contextos em `apps/backend/src/contexts/<domain>/`,
comunicação entre contextos por **EventBus** (nunca import direto), fronteiras vigiadas por
**dependency-cruiser**. Schema Prisma **multi-file** (um por domínio). Estas regras refletem o
código real, não os planos antigos (docs 11/12 são pré-DDD — ignore-os para estrutura).

---

## 1. Contextos e fronteiras 🔴 OBRIGATÓRIO

- Domínios vivem em `apps/backend/src/contexts/<domain>/` (hoje: `chat`, `documents`,
  `impediments`, `kanban`, `me`, `meetings`, `strategic`, `tickets`).
- Cada contexto é um **módulo flat**: `<entity>/<entity>.controller.ts`,
  `<entity>/<entity>.service.ts`, `<entity>/dto/`, `<entity>/events/`, opcional `infrastructure/`.
- **Proibido import direto entre contextos.** `contexts/a/**` não importa de `contexts/b/**`.
  Regra aplicada por `apps/backend/.dependency-cruiser.cjs` (hoje `warn`, vira `error`).
- Um contexto **pode** importar de: `shared/`, `infrastructure/`, `prisma/`, `@mediall/types`.
- Comunicação cross-context é **sempre via evento de domínio** (ver §3).
- A única ponte autorizada a importar de vários contextos é
  `infrastructure/gateway/realtime-event.handler.ts` (bridge de eventos → Socket.IO).
- Ao criar contexto novo: registrá-lo em `app.module.ts` e adicionar (se preciso) exceção
  consciente no dependency-cruiser — não relaxe a regra global.

## 2. Camadas dentro do contexto 🟡 PADRÃO

Fluxo: **Controller → Service → PrismaService → (publica) EventBus**.

- **Controller**: só orquestra. Recebe DTO, chama service, retorna. Sem regra de negócio,
  sem acesso direto ao Prisma. Anotar com `@ApiTags(...)`.
- **Controllers de unidade estendem `BaseUnitController`** (`@Controller('units/:unitId')` +
  guard stack). Nunca redeclarar os guards manualmente — herde.
- **Service**: regra de negócio + persistência. Injeta `PrismaService` e `EventBusService`.
  Publica eventos para efeitos colaterais cross-context (notificação, realtime), nunca chama
  outro contexto direto.
- **DTO**: classe com decorators `class-validator` (ver §6). Um arquivo por DTO em `dto/`.

```ts
@ApiTags('kanban')
@Controller('units/:unitId')
export class TasksController extends BaseUnitController {
  @Post('tasks')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  create(@Param('unitId') unitId: string, @Body() dto: CreateTaskDto, @CurrentUser() user: JwtPayload) {
    return this.tasksService.create(unitId, dto, user)
  }
}
```

## 3. Eventos de domínio 🔴 OBRIGATÓRIO para efeitos cross-context

- Todo evento estende `DomainEvent` (`shared/events/domain-event.base.ts`) e define
  `readonly eventName` no formato `'<domain>.<fato>'` (ex.: `'task.created'`, `'ticket.assigned'`).
- Publique com `this.eventBus.publish(new XEvent(...))` (ou `publishAll([...])`).
- Consuma com `@OnEvent('<eventName>')` em um handler do **contexto interessado**
  (`contexts/<domain>/handlers/*.handler.ts`), nunca no contexto emissor.
- Notificações: emita `NotifyUserRequested` (`shared/events/notification.events.ts`) — não
  chame o serviço de notificação de outro contexto diretamente.
- Eventos são o mecanismo para preparar a futura extração de serviços (plano 17). Trate-os
  como contrato: payload explícito e estável.

## 4. Prisma e banco 🔴 OBRIGATÓRIO

- Schema é **multi-file** em `apps/backend/prisma/schema/`: `_datasource`, `_enums`, `_shared`
  (User/Unit/UserUnit) + um arquivo por contexto (`kanban.prisma`, `chat.prisma`, ...).
  **Coloque cada model no arquivo do seu domínio.** Não centralize tudo em um arquivo.
- Convenções de coluna (do `CLAUDE.md` raiz):
  - PK: `id String @id @default(uuid())`
  - FK: `<entity>_id` (ex.: `plan_id`, `created_by`)
  - Auditoria: `createdAt @map("created_at")`, `updatedAt @updatedAt @map("updated_at")`,
    soft-delete onde aplicável (`isDeleted` / `deletedAt`).
  - Campos camelCase no Prisma → snake_case no DB via `@map`.
  - Boolean com prefixo `is_` / `has_`.
- Acesso a dados **só pelo `PrismaService`** (`prisma/prisma.service.ts`). Ele já loga query
  lenta (>500ms) — não instancie `PrismaClient` avulso.
- Após mudar schema: `npx prisma generate`. Migration: `npx prisma migrate dev` em dev,
  `prisma migrate deploy` em produção. `DB_SYNCHRONIZE` nunca `true` em produção.
- **Toda query de dados de unidade filtra por `unitId`** — regra detalhada em `security.md` §5.
  É também uma regra de arquitetura: nenhum service expõe dados sem escopo.

## 5. Contrato de API 🔴 OBRIGATÓRIO

- Respostas são embrulhadas pelo `TransformInterceptor`:
  `{ data, statusCode, timestamp, correlationId }`. **Retorne o payload cru no service/controller**
  — não monte o envelope manualmente.
- Erros passam pelo `AllExceptionsFilter` (`shared/filters/all-exceptions.filter.ts`): formato
  padrão `{ statusCode, message, timestamp, path, correlationId }`, Sentry em 5xx, log warn em 4xx.
  Lance `HttpException` específica (`NotFoundException`, `ForbiddenException`, `ConflictException`,
  ...). Não retorne `{ error }` ad-hoc nem `res.status().json()` direto.
- **Mensagem de erro é a tratativa que o usuário vai ler.** Para erros de negócio/validação (4xx),
  escreva a `message` **em português, clara e acionável** ("Já existe um plano com esse nome.") —
  o front exibe essa string direto. Não vaze detalhe técnico/SQL na mensagem.
- Erros genéricos (5xx, Prisma desconhecido) já caem em mensagem fixa em inglês
  (`'Internal server error'`, `'Resource already exists'`) — o front os substitui por texto
  amigável (ver `ui.md` §7). Mapeie casos conhecidos do Prisma para `HttpException` com mensagem
  PT quando o usuário puder corrigir (ex.: `P2002` → `ConflictException('Registro já existe.')`).
- `correlationId` acompanha request/erro fim a fim (logs, Sentry) — útil para suporte; **nunca**
  exibido cru ao usuário.
- Prefixo `/api`, versionamento URI default v1 → rotas reais em `/api/v1/...`.
- Rotas em **inglês** (`/units/:unitId/tasks`). `unitId` **sempre vem do path param**, nunca do body.
- Documente endpoints novos no Swagger (`@ApiTags`, e tags registradas no `DocumentBuilder` em `main.ts`).

## 6. Validação de entrada 🔴 OBRIGATÓRIO

- `ValidationPipe` global já roda com `whitelist: true`, `forbidNonWhitelisted: true`,
  `transform: true`. Confie nele, mas **todo DTO precisa de decorators** ou os campos são
  removidos silenciosamente.
- Use os decorators certos: `@IsUUID()`, `@IsEmail()`, `@IsEnum(X)`, `@IsString()`,
  `@IsOptional()`, `@Min/@Max`, `@MinLength`. Nada de `any` em DTO.
- Tipos compartilhados (enums, payloads) vêm de `@mediall/types` — não duplique definição
  entre back e front.

## 7. Real-time (Socket.IO) 🟡 PADRÃO

- Gateway único: `infrastructure/gateway/app.gateway.ts`. JWT verificado no `handleConnection`;
  conexão sem token é desconectada (ver `security.md` §11).
- Use rooms: `unit:<unitId>`, `group:<groupId>`, `meeting:<meetingId>`. Emita por
  `emitToUnit/emitToGroup/emitToMeeting` — não vaze evento para fora do escopo.
- Eventos de domínio → realtime passam pelo `realtime-event.handler.ts`. Service **não**
  emite no socket direto; publica evento e o bridge emite.
- Adapter Redis já configurado para escala horizontal — não quebre isso usando estado
  em memória do processo para roteamento.

## 8. Jobs 🟡 PADRÃO

- Dois mecanismos: `@Cron(...)` (`@nestjs/schedule`) para agendado, e **BullMQ** (`@Processor`)
  para fila/retry. Jobs cron vivem em `src/jobs/`; processors no contexto/infra dono da fila.
- Job dispara efeito via **EventBus**, não chamando vários contextos. Ex.:
  `MeetingReminderJob` publica `MeetingReminderDueEvent`.
- Registre o job como provider em `app.module.ts`.

## 9. Config e ambiente 🔴 OBRIGATÓRIO

- `ConfigModule.forRoot({ isGlobal: true })`. Variáveis críticas são checadas no boot
  (`REQUIRED_ENV_VARS` em `main.ts`) — **adicione toda nova var obrigatória nessa lista**
  para falhar cedo, em vez de usar fallback inseguro no código (ver `security.md` §2/§8).
- Nunca commitar secret. `.env` é gitignored; use `.env.example` para documentar chaves novas.

## 10. Tipos compartilhados 🔴 OBRIGATÓRIO

- `packages/types` (`@mediall/types`) é a fonte única de tipos usados pelos dois apps
  (`JwtPayload`, enums `UserRole`/`AccessScope`, DTOs de contrato, etc.).
- **Nunca redefina** um tipo que já existe lá no front ou no back. Estendeu o contrato?
  Atualize o pacote e importe.
