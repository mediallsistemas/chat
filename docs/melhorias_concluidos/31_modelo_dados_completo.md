---
name: modelo-dados-completo
description: Módulo 10 — Modelo de dados completamente implementado (schema, migrations, seeders, indexes, FKs validadas)
metadata:
  type: project
---

# Plano 10 — Modelo de Dados: Concluído

## O que foi implementado

### Schema Prisma
- Todas as tabelas definidas com relações, enums e campos mapped para snake_case
- Modelos: User, Unit, UserUnit, StrategicPlan, Objective, Goal, PlanPhase, PhaseScopeBoard, MacroTask, KanbanBoard, KanbanColumn, Task, TaskDependency, TaskImpediment, TaskChecklist, TaskFile, Group, GroupMember, Message, MessageReaction, Meeting, MeetingParticipant, Document, DocumentFolder, Ticket, Notification, NotificationSetting, AuditLog, UserConsent, AnonymizedUserLog

### Migrations aplicadas
- `20260509061439_sprint7_8` — base inicial
- `20260509182042_add_documents_tickets_transcription`
- `20260511170221_init`
- `20260511172848_add_message_reactions`
- `20260513000001_add_document_versioning` — versionOf, versionNumber, isLatest
- `20260513000002_group_member_last_read` — lastReadAt em GroupMember
- `20260513000003_add_unit_escalation_thresholds` — escalationDaysLevel1/2 na Unit
- `20260513000004_add_performance_indexes` — indexes em tasks e messages
- `20260513000005_add_phase_scope_boards` — tabela PhaseScopeBoard para UnitScope ALL

### Seeders
- `prisma/seed.ts`: 8 usuários (SUPER_ADMIN/DIRETORIA/GESTOR), 6 unidades (Matriz + UEI/HRGM/HMMDO/HRPG/UPA Zona Sul), grupos GENERAL + Kanban boards por unidade

### Índices de performance
- `tasks`: (unitId+completedAt), (unitId+dueDate), (unitId+updatedAt)
- `messages`: (senderId+createdAt)
- `task_impediments`: (unitId+status), (unitId+createdAt)

### Isolamento
- `unitId` em todas as tabelas de dados + filtros via UnitScopeGuard + BaseUnitController
