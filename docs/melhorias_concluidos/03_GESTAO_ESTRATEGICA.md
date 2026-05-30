# Plano 03 — Gestão Estratégica
## Planos, Objetivos, Metas, OKRs, Etapas, Kanban

---

## Objetivo
Implementar o núcleo de controle estratégico da plataforma: do plano anual da holding até as sub-tarefas operacionais, com etapas sequenciais e Kanban por etapa.

---

## Hierarquia Completa

```
Plano Estratégico
└── Objetivo Estratégico
    └── Meta (Key Result / OKR)
        └── Etapa (Phase)          ← NOVO
            └── Tarefa Macro
                └── Sub-tarefa (Kanban)
```

---

## 1. Plano Estratégico

Criado pela diretoria. Representa o ciclo anual da holding.

**Campos:**
- Nome, período (ano), visão, missão, valores
- Status: DRAFT | ACTIVE | ARCHIVED
- Visibilidade: toda empresa ou apenas diretoria
- Responsável
- Histórico de versões (toda alteração registrada)

**Regras:**
- Progresso calculado automaticamente pela média dos objetivos
- Apenas DIRETORIA e SUPER_ADMIN criam planos

---

## 2. Objetivo Estratégico

Desdobramento do plano por área ou tema.

**Campos:**
- Título, descrição, ganhos esperados
- Área responsável, responsável principal
- Prazo, co-responsáveis
- Farol automático: 🟢 ≥70% | 🟡 40–69% | 🔴 <40%
- Grupo de comunicação vinculado (opcional)

**Regras:**
- Progresso = média das metas vinculadas
- Farol calculado comparando progresso atual vs curva linear esperada

---

## 3. Meta (Key Result)

Resultado mensurável vinculado a exatamente um objetivo.

**Campos:**
- Título, descrição, área estratégica
- Investimento previsto
- Direção: ↑ (subir) ou ↓ (descer)
- Método de cálculo: SOMA | PERCENTUAL | BINÁRIO
- Meta inicial, meta alvo, valor atual
- Status automático: NOT_STARTED | IN_PROGRESS | AT_RISK | DONE

**Regras:**
- Progresso calculado pelas etapas vinculadas
- Status calculado automaticamente — não editável manualmente

---

## 4. Etapa (Phase) ← NOVO

Divisão sequencial dentro de uma meta. Cada etapa tem seu próprio Kanban. A próxima etapa só é desbloqueada quando a anterior é concluída.

**Campos:**
- Título, descrição
- Ordem (sequência)
- Responsável, co-responsáveis
- Data de início prevista, prazo
- Status: LOCKED | ACTIVE | ARCHIVED
- Kanban board próprio
- Unidade responsável: ALL | SPECIFIC | MATRIX

**Comportamento:**
- Ao criar a meta, define-se todas as etapas em sequência
- Apenas a etapa ACTIVE tem Kanban editável
- Etapas LOCKED são visíveis mas não editáveis
- Ao marcar etapa como concluída:
  1. Kanban é arquivado automaticamente
  2. Próxima etapa muda para ACTIVE
  3. Responsáveis da próxima etapa são notificados
- Progresso da meta = (etapas concluídas / total etapas) × 100

**Etapa com escopo de unidade:**
- ALL: todas as unidades executam em paralelo, cada uma com seu Kanban
- SPECIFIC: apenas uma unidade executa, outras visualizam progresso
- MATRIX: executada centralmente pela matriz

---

## 5. Tarefa Macro

Grande entrega dentro de uma etapa.

**Campos:**
- Título, descrição
- Etapa vinculada, meta vinculada, objetivo vinculado
- Área responsável, responsável principal
- Datas de início e fim
- Status: NOT_STARTED | IN_PROGRESS | BLOCKED | REVIEW | DONE
- Progresso = % sub-tarefas concluídas
- Kanban board próprio
- Grupo temporário criado automaticamente (opcional)

---

## 6. Sub-tarefa (Kanban)

Unidade de trabalho individual. Cartão no Kanban.

**Campos obrigatórios:**
- Título
- Responsável principal (aceite obrigatório)
- Data de início e prazo
- Status (determinado pela coluna do Kanban)
- Setor responsável
- Vínculo estratégico (meta + objetivo)

**Campos opcionais:**
- Descrição com critério de conclusão
- Co-responsáveis, observadores
- Prioridade: LOW | MEDIUM | HIGH | URGENT
- Checklist interno
- Arquivos e evidências
- Comentários com @menção
- Estimativa e registro de horas
- Dependências entre tarefas
- Tags
- Campo de impedimento

---

## Kanban — Estrutura

**Colunas padrão:**
```
Backlog → Em andamento → Impedido → Em revisão → Concluído
```

**Funcionalidades:**
- Colunas customizáveis por grupo ou tarefa macro
- Limite de WIP configurável por coluna
- Drag-and-drop
- Visualizações: Kanban | Lista | Calendário | Timeline (Gantt)
- Todo movimento registrado com data, hora e autor

**Regras:**
- Mover para Concluído exige checklist 100% (se existir)
- Tarefas vencidas mudam de cor automaticamente
- Progresso da tarefa macro recalculado em tempo real

---

## Cálculo de Progresso (de baixo para cima)

```
Sub-tarefa:    0% ou 100% (binário)
Tarefa Macro:  (concluídas / total) × 100
Etapa:         (tarefas macro concluídas / total) × 100
Meta:          (etapas concluídas / total) × 100
Objetivo:      média das metas
Plano:         média dos objetivos
```

Nenhuma atualização manual necessária nos níveis superiores.

---

## Permissões por nível

| Ação | SUPER_ADMIN | DIRETORIA | GESTOR | COLABORADOR | VISUALIZADOR |
|------|-------------|-----------|--------|-------------|--------------|
| Criar plano | ✅ | ✅ | ❌ | ❌ | ❌ |
| Criar objetivo | ✅ | ✅ | ✅ (seu setor) | ❌ | ❌ |
| Criar meta/etapa | ✅ | ✅ | ✅ | ❌ | ❌ |
| Criar tarefa | ✅ | ✅ | ✅ | ✅ | ❌ |
| Mover Kanban | ✅ | ✅ | ✅ | ✅ | ❌ |
| Concluir etapa | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver painel consolidado | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Checklist de Implementação

### Schema / Banco de Dados
- [x] Tabela `strategic_plans`
- [x] Tabela `objectives`
- [x] Tabela `goals` (metas/OKRs)
- [x] Tabela `plan_phases` (etapas)
- [x] Tabela `macro_tasks`
- [x] Tabela `tasks` (sub-tarefas/Kanban)
- [x] Tabela `kanban_boards`
- [x] Tabela `kanban_columns`
- [x] Tabela `task_checklists`

### Backend — API REST
- [x] `GET/POST /units/:unitId/plans` — listar e criar planos
- [x] `GET /units/:unitId/plans/:planId` — detalhe do plano com objetivos
- [x] `PATCH /units/:unitId/plans/:planId/activate` — ativar plano
- [x] `PATCH /units/:unitId/plans/:planId/archive` — arquivar plano
- [x] `GET/POST /units/:unitId/plans/:planId/objectives` — objetivos com metas incluídas
- [x] `GET/POST /units/:unitId/objectives/:objectiveId/goals` — metas com etapas incluídas
- [x] `GET/POST /units/:unitId/goals/:goalId/phases` — etapas
- [x] `PATCH /units/:unitId/goals/:goalId/phases/:phaseId/complete` — concluir etapa
- [x] Lógica de desbloqueio automático de etapas (LOCKED → ACTIVE)
- [x] Kanban board criado automaticamente ao criar etapa (5 colunas padrão)
- [x] Cálculo de progresso bottom-up em tempo real
- [x] Farol automático por objetivo (≥70% verde, 40–69% amarelo, <40% vermelho)

### Frontend — Página `/processos`
- [x] Hooks TanStack Query para toda a hierarquia (`usePlans`, `useObjectives`, `useGoals`, `useCreatePlan/Objective/Goal/Phase`, `useCompletePhase`, `useActivatePlan`, `useArchivePlan`)
- [x] Página `/processos` integrada com API real (mock data removido)
- [x] Sidebar de planos com status (DRAFT/ACTIVE/ARCHIVED) e contagem de objetivos
- [x] Accordions de objetivos com progresso real
- [x] Listagem de metas com farol calculado e progresso
- [x] Timeline visual de etapas (LOCKED/ACTIVE/ARCHIVED) por meta
- [x] Modal de criação de plano (nome, ano, visão, missão, valores)
- [x] Modal de criação de objetivo (título, responsável, prazo, descrição, benefícios)
- [x] Modal de criação de meta (título, direção, método de cálculo, valores)
- [x] Modal de criação de etapa (título, ordem, responsável, escopo, datas)
- [x] Componentes UI: `Input`, `Select`, `Textarea` (com label e erro)

- [x] Módulo backend de `MacroTask` (controller + service + auto-cria Kanban board)
- [x] Hooks TanStack Query para Kanban (`useKanbanBoard`, `useCreateTask`, `useMoveTask`, `useAcceptTask`, `useDeclineTask`)
- [x] Componentes `KanbanCard`, `KanbanColumn`, `KanbanBoard` com drag-and-drop (`react-beautiful-dnd`, `dynamic ssr:false`)
- [x] Skeleton screen do Kanban board
- [x] Modal de criação de tarefa (título, responsável, prioridade, datas)
- [x] Página de detalhe de meta `/processos/[planId]/[objectiveId]/[goalId]` com timeline de etapas e Kanban da etapa ativa
- [x] Atualização otimista de drag-and-drop (revert on error)
- [x] Skeleton screens para lista de planos e objetivos
- [x] `error.tsx` em `/processos` (error boundary do Next.js App Router)
- [x] Link "Etapas →" em cada meta apontando para a página de detalhe

### Pendente
- [x] Visualização Lista (KanbanListView) e Calendário (KanbanCalendarView)
- [x] Visualização Timeline (Gantt) — KanbanGanttView implementado
- [x] Painel de gestão estratégica por unidade — GET /units/:unitId/plans/panel + /processos/painel com métricas e lista de objetivos
- [x] Seletor de usuário responsável — UserCombobox (shared/components/ui/user-combobox.tsx) com useUnitMembers hook, aplicado em todos os modais de criação/edição
- [x] Edição de plano, objetivo, meta e etapa (PATCH endpoints + modais)
