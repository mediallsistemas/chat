---
name: ui-templates-completo
description: Módulo 15 — Templates UI completamente implementados (design tokens, componentes, acessibilidade)
metadata:
  type: project
---

# Plano 15 — UI Templates: Concluído

## O que foi implementado

### Design System
- Design tokens Tailwind: `gd` (dark), `gn` (brand), `gs` (stroke), `gx` (muted), `page-bg`
- Fonte Sora aplicada
- Componentes UI: Button, Avatar, Modal, ProgressBar, TrafficLight, Badge, MetricCard, PageHeader

### Boas Práticas
- `tsconfig.json` com `strict: true`
- react-hook-form + zod em todos os formulários (Login, Novo Usuário, Nova Tarefa, Resolve Impedimento, etc.)
- `error.tsx` em todas as rotas autenticadas (processos, kanban, impedimentos, mensagens, reunioes, documentos, chamados, dashboard, processos/painel)
- Skeleton screens: Dashboard, Processos, Kanban, Impedimentos (lista + sidebar)
- `aria-label` em todos os botões icon-only
- Focus trap + Escape em modais
- KanbanBoard com `dynamic({ ssr: false })`
- Query keys hierárquicas: `['plans', unitId]`, `['kanban', unitId, boardId]`
- Barrel exports `index.ts` em todas as pastas de componentes
