---
name: painel-diretoria-completo
description: Módulo 05 — Painel da Diretoria implementado completamente (exceto faróis WebSocket)
metadata:
  type: project
---

# Plano 05 — Painel da Diretoria: Concluído

> Implementado ao longo das sessões de Maio 2026.

## O que foi implementado

### Backend
- `GET /dashboard/summary?unitId=&from=&to=` — métricas consolidadas com filtros de unidade e período
- `GET /dashboard/units/:unitId` — drill-down completo de uma unidade (planos, impedimentos, métricas)
- `GET /dashboard/stale-tasks` — tarefas sem atualização há 3+ dias (check-in alerts)
- `GET /units/:unitId/reports/dashboard/pdf` — exportação PDF executiva (PDFKit, 3 seções)
- `GET /units/:unitId/reports/dashboard/excel` — exportação Excel executiva (ExcelJS, 3 abas: Planos, Impedimentos, Tarefas Atrasadas)
- `generalGroupId` incluído no summary para botão de contato rápido por unidade

### Frontend (`apps/frontend/src/app/(auth)/dashboard/page.tsx`)
- Cards de métricas (planos, impedimentos, tarefas atrasadas, metas em risco)
- Grid de unidades com faróis e barras de progresso
- Cards de unidade são links clicáveis para `/dashboard/unidades/[unitId]`
- Botão de chat por unidade (aparece no hover, abre `/mensagens?group=<generalGroupId>`)
- Seção "Impedimentos Críticos" com top 5 escalados
- Seção "Tarefas sem atualização" (aparece quando há tarefas estagnadas 3+ dias)
- Seção de alertas proativos (vencidas, metas em risco, impedimentos)
- Botões PDF e Excel no header
- Drill-down `/dashboard/unidades/[unitId]` com `useDashboardUnit`

### Hooks
- `useDashboard()` — `/dashboard/summary`
- `useDashboardUnit(unitId)` — `/dashboard/units/:unitId`
- `useStaleTaskAlerts()` — `/dashboard/stale-tasks`
- `useDownloadDashboardPdf()` / `useDownloadDashboardExcel()`

## Item pendente (baixa prioridade)
- Faróis em tempo real via WebSocket — dashboard atualiza a cada 30s via staleTime, sem push do servidor
