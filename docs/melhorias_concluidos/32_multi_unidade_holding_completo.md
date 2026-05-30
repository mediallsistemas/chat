---
name: multi-unidade-holding-completo
description: Módulo 13 — Multi-unidade / Holding completamente implementado (JWT escopo, UnitScopeGuard, UnitScope ALL/SPECIFIC/MATRIX, onboarding, drill-down)
metadata:
  type: project
---

# Plano 13 — Multi-unidade / Holding: Concluído

## O que foi implementado

### Autenticação multi-unidade
- Array `units[]` de IDs no payload JWT — sem DB hit a cada request
- `UnitScopeGuard`: GLOBAL passa tudo, MULTI/SINGLE verifica `unitId` da rota em `user.units[]`
- `BaseUnitController`: prefixo `units/:unitId` + guards automáticos

### Seletor de unidade no frontend
- Header.tsx com dropdown para usuários MULTI
- `unitStore` Zustand: `setUnits`, `switchUnit`, `activeUnit`
- Todas as queries TanStack Query usam `unitStore.activeUnit.id`

### UnitScope das etapas (PlanPhase)
- **ALL**: cria uma `PhaseScopeBoard` por unidade ativa (Kanban dedicado por unidade)
  - Conclusão da etapa bloqueia se outra unidade ainda tem tarefas pendentes
  - `GET /goals/:goalId/phases/:phaseId/scope-progress` — progresso por unidade
  - Frontend: `ScopeProgressPanel` com barras de progresso por unidade + links Kanban
- **SPECIFIC**: uma unidade executa (unitId na fase), outras visualizam apenas
- **MATRIX**: executada pela unidade raiz (unitId da fase = unitId da rota de criação)

### Onboarding de nova unidade
- `UnitsService.onboardUnit()` — cria grupo GENERAL + KanbanBoard com 3 colunas padrão automaticamente ao criar unidade via `POST /units`

### Painel da diretoria
- Dashboard consolidado com filtros `?unitId=&from=&to=`
- Drill-down por unidade: `GET /dashboard/units/:unitId` + `/dashboard/unidades/[unitId]`

### Grupos da holding
- Grupo GENERAL criado para cada unidade (incluindo Matriz) via seed e onboarding
- `generalGroupId` incluído no `/dashboard/summary` para botão de contato rápido
