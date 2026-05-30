# Plano 10 — Modelo de Dados
## Todas as tabelas, relações e Prisma schema

> Última revisão: 2026-05-23 — alinhado com plano 17 (split por domínio planejado).

---

## Objetivo
Definir o modelo de dados completo da plataforma como referência única para desenvolvimento.

---

## Organização do schema — atual e planejado

**Hoje (atual):** schema único em `apps/backend/prisma/schema.prisma` — 30 models, ~817 linhas.

**Planejado (plano 17, Fase 1.3):** split em múltiplos arquivos via `prismaSchemaFolder` (preview Prisma 5+), com **um arquivo por contexto DDD**:

```
apps/backend/prisma/
├── schema.prisma              ← datasource + generator + shared (User, Unit, UserUnit)
└── schemas/
    ├── auth.prisma            ← RefreshToken, AuditLog
    ├── strategic.prisma       ← Plan, Objective, Goal, Phase, MacroTask
    ├── kanban.prisma          ← Board, Column, Task, TaskFile
    ├── chat.prisma            ← Group, GroupMember, Message, Reaction
    ├── meetings.prisma        ← Meeting, MeetingParticipant
    ├── transcription.prisma   ← Transcript, TranscriptSegment
    ├── notifications.prisma   ← Notification, NotificationSettings
    ├── impediments.prisma     ← Impediment, EscalationLog
    ├── tickets.prisma         ← Ticket, TicketComment
    ├── documents.prisma       ← Document, DocumentVersion
    └── consents.prisma        ← UserConsent, ConsentLog
```

**Modelos transversais que permanecem no `schema.prisma` raiz:**
- `User` (aparece em 11 models)
- `Unit` (aparece em 8+ models)
- `UserUnit` (junction)

**Regras associadas (impostas por boundary lint + revisão):**
- Cada `contexts/<domain>/infrastructure/repositories/*.ts` só consulta models do seu próprio arquivo `.prisma`
- Exceção: leitura de `User`/`Unit` permitida (transversais)
- Cross-domain reads de outros modelos: usar Read Models / Ports (não join Prisma direto). Ver plano 17, Fase 1.4.

---

## Convenções de Nomenclatura do Banco

- **Nomes de tabelas**: inglês, snake_case — `strategic_plans`, `kanban_columns`, `user_units`
- **Nomes de colunas**: inglês, snake_case — `created_at`, `user_id`, `is_active`, `unit_id`
- **Chaves primárias**: sempre `id` (UUID)
- **Chaves estrangeiras**: `<entidade>_id` em inglês — `plan_id`, `goal_id`, `created_by`
- **Campos de auditoria**: `created_at`, `updated_at`, `deleted_at` (soft delete)
- **Campos booleanos**: prefixo `is_` ou `has_` — `is_active`, `is_deleted`, `has_attachment`
- **No Prisma schema**: campos em camelCase mapeados para snake_case via `@map` — `createdAt @map("created_at")`

---

## Diagrama de Relações (resumido)

```
units ──────────────────────────── users
  │                                  │
  └── user_units (N:N) ──────────────┘
  
strategic_plans
  └── objectives
        └── goals
              └── plan_phases (NOVO)
                    └── macro_tasks
                          └── kanban_boards
                                └── kanban_columns
                                      └── tasks
                                            └── task_impediments
                                            └── task_checklists

groups
  └── group_members
  └── messages
  └── kanban_boards

meetings
  └── meeting_participants
```

---

## Tabelas de Unidades e Usuários

```prisma
model Unit {
  id        String   @id @default(uuid())
  name      String
  type      UnitType // MATRIZ | UNIDADE
  parentId  String?
  parent    Unit?    @relation("UnitHierarchy", fields: [parentId], references: [id])
  children  Unit[]   @relation("UnitHierarchy")
  managerId String
  manager   User     @relation(fields: [managerId], references: [id])
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
}

model User {
  id          String      @id @default(uuid())
  name        String
  email       String      @unique
  passwordHash String
  avatarUrl   String?
  accessScope AccessScope // GLOBAL | MULTI | SINGLE
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  lastSeenAt  DateTime?
  unitAccess  UserUnit[]
}

model UserUnit {
  id         String   @id @default(uuid())
  userId     String
  unitId     String
  role       UserRole // role nesta unidade específica
  isPrimary  Boolean  @default(false)
  grantedBy  String
  grantedAt  DateTime @default(now())
  expiresAt  DateTime?
  user       User     @relation(fields: [userId], references: [id])
  unit       Unit     @relation(fields: [unitId], references: [id])
}
```

---

## Tabelas de Gestão Estratégica

```prisma
model StrategicPlan {
  id          String     @id @default(uuid())
  name        String
  year        Int
  vision      String?
  mission     String?
  values      String?
  status      PlanStatus // DRAFT | ACTIVE | ARCHIVED
  unitId      String     // qual unidade ou MATRIZ
  createdBy   String
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  objectives  Objective[]
}

model Objective {
  id                  String      @id @default(uuid())
  planId              String
  title               String
  description         String?
  benefits            String?
  responsibleSectorId String
  responsibleUserId   String
  deadline            DateTime
  status              GoalStatus
  progressPct         Decimal     @default(0)
  trafficLight        TrafficLight // GREEN | YELLOW | RED
  groupId             String?
  unitId              String
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
  goals               Goal[]
}

model Goal {
  id            String     @id @default(uuid())
  objectiveId   String
  title         String
  description   String?
  sectorId      String
  investment    Decimal?
  direction     Direction  // UP | DOWN
  calcMethod    CalcMethod // SUM | PERCENTAGE | BINARY
  targetValue   Decimal?
  currentValue  Decimal    @default(0)
  initialValue  Decimal    @default(0)
  status        GoalStatus
  progressPct   Decimal    @default(0)
  unitId        String
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  phases        PlanPhase[]
}

// NOVA TABELA — Etapas sequenciais
model PlanPhase {
  id          String      @id @default(uuid())
  goalId      String
  title       String
  description String?
  order       Int         // sequência
  status      PhaseStatus // LOCKED | ACTIVE | ARCHIVED
  unitScope   UnitScope   // ALL | SPECIFIC | MATRIX
  unitId      String?     // se SPECIFIC
  responsibleUserId String
  startDate   DateTime?
  dueDate     DateTime?
  completedAt DateTime?
  kanbanBoardId String
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  goal        Goal        @relation(fields: [goalId], references: [id])
  kanbanBoard KanbanBoard @relation(fields: [kanbanBoardId], references: [id])
  macroTasks  MacroTask[]
}

model MacroTask {
  id                String    @id @default(uuid())
  phaseId           String
  goalId            String
  objectiveId       String
  title             String
  description       String?
  responsibleUserId String
  sectorId          String
  unitId            String
  startDate         DateTime?
  dueDate           DateTime?
  status            TaskStatus
  progressPct       Decimal   @default(0)
  groupId           String?
  kanbanBoardId     String
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

---

## Tabelas de Kanban

```prisma
model KanbanBoard {
  id        String      @id @default(uuid())
  name      String
  ownerType BoardOwner  // GROUP | MACRO_TASK | PHASE
  ownerId   String
  unitId    String
  createdAt DateTime    @default(now())
  columns   KanbanColumn[]
  tasks     Task[]
}

model KanbanColumn {
  id           String   @id @default(uuid())
  boardId      String
  name         String
  position     Int
  wipLimit     Int?
  isDoneColumn Boolean  @default(false)
  color        String?
  createdAt    DateTime @default(now())
}

model Task {
  id                String           @id @default(uuid())
  boardId           String
  columnId          String
  macroTaskId       String?
  title             String
  description       String?
  responsibleUserId String
  createdBy         String
  priority          Priority         // LOW | MEDIUM | HIGH | URGENT
  startDate         DateTime?
  dueDate           DateTime?
  estimatedHours    Decimal?
  actualHours       Decimal?
  position          Int
  isBlocked         Boolean          @default(false)
  acceptanceStatus  AcceptanceStatus // PENDING | ACCEPTED | DECLINED
  unitId            String
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  completedAt       DateTime?
  impediments       TaskImpediment[]
  checklists        TaskChecklist[]
}

model TaskImpediment {
  id                        String          @id @default(uuid())
  taskId                    String
  reportedBy                String
  description               String
  responsibleForResolution  String
  expectedResolutionDate    DateTime
  status                    ImpedimentStatus // BLOCKED | ATTENTION | RESOLVED
  resolvedBy                String?
  resolutionNotes           String?
  escalationLevel           Int              @default(0)
  unitId                    String
  createdAt                 DateTime         @default(now())
  updatedAt                 DateTime         @updatedAt
  resolvedAt                DateTime?
}
```

---

## Tabelas de Comunicação

```prisma
model Group {
  id             String    @id @default(uuid())
  name           String
  description    String?
  type           GroupType // GENERAL | SECTOR | SUBSECTOR | PROJECT | TEMPORARY | PRIVATE
  parentId       String?
  sectorId       String?
  objectiveId    String?
  unitId         String
  createdBy      String
  avatarUrl      String?
  isArchived     Boolean   @default(false)
  archiveAt      DateTime?
  kanbanBoardId  String
  onlyAdminsPost Boolean   @default(false)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  members        GroupMember[]
  messages       Message[]
}

model GroupMember {
  id       String          @id @default(uuid())
  groupId  String
  userId   String
  role     GroupMemberRole // ADMIN | MEMBER | VIEWER
  joinedAt DateTime        @default(now())
  addedBy  String
}

model Message {
  id        String      @id @default(uuid())
  groupId   String
  senderId  String
  content   String
  type      MessageType // TEXT | FILE | IMAGE | SYSTEM
  replyToId String?
  isPinned  Boolean     @default(false)
  isEdited  Boolean     @default(false)
  editedAt  DateTime?
  isDeleted Boolean     @default(false)
  deletedAt DateTime?
  createdAt DateTime    @default(now())
}
```

---

## Tabelas de Reuniões

```prisma
model Meeting {
  id              String        @id @default(uuid())
  title           String
  description     String?
  groupId         String?
  unitId          String
  createdBy       String
  startAt         DateTime
  endAt           DateTime
  roomId          String
  isRecurring     Boolean       @default(false)
  recurrenceRule  String?
  parentMeetingId String?
  status          MeetingStatus // SCHEDULED | IN_PROGRESS | DONE | CANCELLED
  recordingUrl    String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  participants    MeetingParticipant[]
}

model MeetingParticipant {
  id        String              @id @default(uuid())
  meetingId String
  userId    String
  status    ParticipantStatus   // INVITED | ACCEPTED | DECLINED | ATTENDED
  joinedAt  DateTime?
  leftAt    DateTime?
}
```

---

## Tabela de Auditoria

```prisma
model AuditLog {
  id        String   @id @default(uuid())
  userId    String
  unitId    String?
  action    String   // ex: 'task.created', 'user.login', 'phase.completed'
  entityId  String?
  entityType String?
  metadata  Json?    // dados extras sem dados sensíveis de pacientes
  ipAddress String
  createdAt DateTime @default(now())
}
```

---

## Checklist de Implementação

- [x] Criar `schema.prisma` completo (todas as tabelas, enums, relações)
- [x] Migrations aplicadas (13 migrations, última: `20260523000000_modular_monolith_phase1`)
- [x] Seeders para dados iniciais (`prisma/seed.ts` + `prisma/seed-strategic.ts`)
- [x] Validar relações e foreign keys (`npx prisma validate` ✅)
- [x] Isolamento por `unitId` garantido via UnitScopeGuard + BaseUnitController (todas as rotas de dados)
- [x] Índices de performance compostos (ver `melhorias_concluidos/12_database_indexes.md` + indexes em messages, tasks, impediments, audit_logs)
