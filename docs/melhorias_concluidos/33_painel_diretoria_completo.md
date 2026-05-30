---
name: painel-diretoria-completo
description: Módulo 05 — Painel da Diretoria completamente implementado (dashboard consolidado, faróis WebSocket, drill-down, alertas, exportação)
metadata:
  type: project
---

# Plano 05 — Painel da Diretoria: Concluído

## O que foi implementado

### Dashboard consolidado
- `GET /dashboard/summary` com métricas reais filtradas por escopo (GLOBAL/MULTI) + filtros `?unitId=&from=&to=`
- Farol por objetivo (GREEN/YELLOW/RED) calculado bottom-up de tasks → phases → goals → objectives
- Cards de resumo: planos ativos, impedimentos, tarefas bloqueadas, tarefas atrasadas, metas em risco

### Faróis em tempo real via WebSocket
- `DashboardUpdatedEvent` emitido por `ObjectivesService.recalculateProgress()` após cada recálculo
- `RealtimeEventHandler` captura e emite `dashboard:update` para o room `unit:<unitId>` via Socket.IO
- `useDashboard()` escuta `dashboard:update` e invalida `['dashboard', 'summary']` automaticamente

### Drill-down
- Drill-down por unidade: `GET /dashboard/units/:unitId` + `/dashboard/unidades/[unitId]` no frontend
- Drill-down por objetivo: link de plano → `/processos/[planId]/[objectiveId]`
- Clique em impedimento → histórico completo

### Botão de contato rápido
- `generalGroupId` retornado no `/dashboard/summary` por unidade
- Ícone de chat nos cards de unidade que navega para `/mensagens?group=<generalGroupId>`

### Exportação
- PDF via `GET /reports/dashboard/pdf` + `useDownloadDashboardPdf`
- Excel via `GET /reports/dashboard/excel` + `useDownloadDashboardExcel`

### Alertas proativos
- Seção dinâmica no frontend com alertas por categoria
- Tarefas sem atualização: `GET /dashboard/stale-tasks` + `useStaleTaskAlerts`
- Deadline alert job: cron diário 7h notifica tarefas vencendo em 48h
