---
name: impedimentos-completo
description: Módulo 04 — Impedimentos completamente implementado (escalonamento, notificações, analytics, exportação)
metadata:
  type: project
---

# Plano 04 — Impedimentos: Concluído

## O que foi implementado

### Backend
- `POST /tasks/:id/impediments` — cria impedimento, bloqueia tarefa se BLOCKED, publica ImpedimentCreatedEvent
- `PATCH /impediments/:id/resolve` — resolve impedimento, desbloqueia tarefa se sem bloqueios ativos, publica ImpedimentResolvedEvent
- `GET /units/:unitId/impediments` — lista impedimentos ativos com tarefa vinculada
- `GET /units/:unitId/impediments/analytics` — métricas completas:
  - blocked, attention, resolvedLast30, resolvedThisWeek, avgResolutionHours, avgResolutionDays
  - byEscalationLevel (0/1/2), topAssignees (top 5 responsáveis), bySector (por macroTaskId), recurring (tarefas com 2+ impedimentos em 90d)
- `GET/PATCH /units/:unitId/impediments/escalation-config` — thresholds por unidade
- `ImpedimentEscalationJob` — cron 8h diário, per-unit thresholds
- `ImpedimentNotificationHandler` — notifica imediatamente ao criar BLOCKED + ao escalonar com histórico

### Frontend (`apps/frontend/src/app/(auth)/impedimentos/page.tsx`)
- Cards de métricas (bloqueadas, em atenção, resolvidas 30d)
- Lista filtrada (Ativos / Bloqueado / Atenção / Resolvido)
- Skeleton para lista + sidebar analytics
- Modal de resolução com campo obrigatório de notas (react-hook-form + zod)
- Sidebar: tempo médio, por escalação, top responsáveis, por setor, recorrentes
- Card de configuração inline de prazos de escalonamento por unidade
- Botões PDF e Excel no header

### Notificações implementadas via EventBus
- `impediment.created` → notifica `responsibleForResolution` + `unitManagerId` (exceto quem criou)
- `impediment.escalated` → notifica manager + responsible com daysOpen + description completa
