# Plano 15 — UI Templates & Design System
## Telas, tokens, componentes e padrões visuais

---

## Objetivo
Documentar o design system extraído dos mockups HTML e definir o plano de implementação das telas no Next.js.

---

## Design Tokens

### CSS Variables (`globals.css`)

```css
:root {
  /* Brand greens */
  --gd: #0D3B2E;   /* dark green — sidebar, headers */
  --gm: #1A4D3A;   /* mid green — hover states, secondary */
  --gn: #BFEF45;   /* neon lime — active, accent, CTA */
  --bg: #EDF2EE;   /* light background — page bg */
  --wh: #FFFFFF;   /* white — cards, panels */
  --gs: #C8D4C9;   /* subtle green — borders, dividers */
  --gx: #6B7E6D;   /* muted green — secondary text */

  /* Semantic aliases */
  --color-sidebar:     var(--gd);
  --color-active:      var(--gn);
  --color-page-bg:     var(--bg);
  --color-card:        var(--wh);
  --color-border:      var(--gs);
  --color-text-muted:  var(--gx);
}
```

### Typography

```css
/* Google Fonts: Sora (headings, labels) + DM Sans (body) */
font-family: 'Sora', 'DM Sans', sans-serif;
```

### Icon Library

```
@tabler/icons-webfont@2.44.0
CDN: https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css
```

Usage: `<i className="ti ti-home" />`

### Status Colors

| Status | Color | Hex |
|--------|-------|-----|
| Verde (on track) | `text-green-600` | `#16a34a` |
| Amarelo (attention) | `text-yellow-500` | `#eab308` |
| Vermelho (blocked) | `text-red-500` | `#ef4444` |
| Azul (info) | `text-blue-500` | `#3b82f6` |

---

## Layout Principal

```
┌──────────────────────────────────────────────────────┐
│  [52px sidebar] │ [header 56px]                       │
│                 ├─────────────────────────────────────┤
│  dark green     │                                     │
│  icon-only      │         page content                │
│  nav            │         (scrollable)                │
│                 │                                     │
│  [avatar]       │                                     │
└──────────────────────────────────────────────────────┘
```

### Sidebar (52px)
- Background: `var(--gd)` (#0D3B2E)
- Width: 52px fixed, full height
- Nav icons centered, 40px touch target
- Active item: `background: rgba(191,239,69,0.15); color: var(--gn);`
- Hover: `background: rgba(255,255,255,0.08)`
- Avatar initials circle at bottom: 36px, `background: var(--gn); color: var(--gd)`
- Logo area at top: 52px × 52px, white Mediall mark

### Header (56px)
- Background: `var(--wh)`
- Border-bottom: `1px solid var(--gs)`
- Left: breadcrumb / page title
- Center (MULTI users): `"Acessando: [UPA Zona Sul ▼]"` — unit selector dropdown
- Right: notifications bell (badge), avatar menu

---

## Inventário de Telas

### 1. Login (`/login`)
**Status:** Implementada (básica)
**Needs:** Aplicar design tokens, logo, fundo verde

### 2. Dashboard (`/dashboard`)
**Roles:** DIRETORIA, SUPER_ADMIN
**Layout:**

```
┌─ Métricas (4 cards) ──────────────────────────────────┐
│  Planos Ativos │ Metas no Prazo │ Impedimentos │ UPAs  │
└───────────────────────────────────────────────────────┘
┌─ Unidades (grid 3 cols) ──────────────────────────────┐
│  [UEI ● verde] [HRGM ● amarelo] [HMMDO ● verde] ...   │
└───────────────────────────────────────────────────────┘
┌─ Impedimentos Críticos ──┬─ Planos Estratégicos ──────┐
│  card, card, card        │  list item, list item       │
└──────────────────────────┴─────────────────────────────┘
┌─ Alertas Proativos ───────────────────────────────────┐
│  ⚠ Tarefa X vence em 2 dias  ·  ⚠ Meta Y atrasada     │
└───────────────────────────────────────────────────────┘
```

**Componentes necessários:**
- `MetricCard` — número grande, label, variação ↑↓
- `UnitTrafficLight` — nome da unidade + farol colorido + progress bar
- `ImpedimentCard` — título, responsável, dias bloqueado, botão resolver
- `PlanListItem` — nome do plano, barra de progresso, farol
- `AlertBanner` — ícone ⚠, mensagem, link de ação

### 3. Processos / Planos Estratégicos (`/processos`)
**Roles:** Todos (filtrado por unidade)
**Layout:**

```
┌─ Sidebar 200px ──┬─ Conteúdo ─────────────────────────┐
│  [Plano A] ●     │  [Nome do Plano] [Período] [Status] │
│  [Plano B]       │  Progresso geral: ████████░░ 78%    │
│  [+ Novo]        ├────────────────────────────────────┤
│                  │  ▼ Objetivo 1                       │
│                  │    ► Meta 1.1 ████░ 60% 🟡          │
│                  │    ► Meta 1.2 ████████ 100% 🟢       │
│                  │  ▼ Objetivo 2                       │
│                  │    ► Meta 2.1 ██░ 20% 🔴 [Etapas →] │
└──────────────────┴─────────────────────────────────────┘
```

**Componentes necessários:**
- `PlanSidebar` — lista de planos, badge status, botão novo plano
- `PlanHeader` — nome, período, progress bar geral, farol
- `ObjectiveAccordion` — colapsável, lista de metas
- `GoalRow` — nome, barra progresso, farol, link para etapas
- `PhaseTimeline` — etapas horizontais LOCKED/ACTIVE/ARCHIVED

### 4. Fases / Etapas (`/processos/[planId]/[objectiveId]/[goalId]`)
**Layout:**

```
┌─ Breadcrumb ────────────────────────────────────────────┐
│  Planos > Objetivo 1 > Meta 1.1                         │
├─ Timeline de Etapas ────────────────────────────────────┤
│  [●Etapa 1 DONE]──[●Etapa 2 ACTIVE]──[○Etapa 3 LOCKED] │
├─ Kanban da Etapa Ativa ─────────────────────────────────┤
│  Backlog │ Em andamento │ Impedido │ Em revisão │ Pronto │
└─────────────────────────────────────────────────────────┘
```

### 5. Kanban (`/kanban/[boardId]`)
**Roles:** Todos (filtrado por unidade)
**Layout:**

```
┌─ Header: [Nome do Board] [+ Nova Tarefa] [Filtros] ─────┐
├─ Colunas (scroll horizontal) ───────────────────────────┤
│ ┌─Backlog(5)─┐ ┌─Em Prog(3)─┐ ┌─Impedido(1)─┐ ...      │
│ │ [Card]     │ │ [Card]     │ │ [Card 🔴]   │           │
│ │ [Card]     │ │ [Card]     │ │             │           │
│ │ [+ add]    │ │ [+ add]    │ │             │           │
│ └────────────┘ └────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────┘
```

**Componentes necessários:**
- `KanbanBoard` — scroll horizontal, drag context
- `KanbanColumn` — título, WIP badge, lista de cards, botão add
- `KanbanCard` — título, assignee avatar, priority dot, tags, checklist count, impediment badge

### 6. Impedimentos (`/impedimentos` — rota a criar)
**Layout:**

```
┌─ Métricas (3 cards) ─────────────────────────────────────┐
│  Bloqueadas │ Em Atenção │ Resolvidas (30d)               │
├─ Lista ──────────────────┬─ Sidebar Análise ─────────────┤
│  [card impedimento]      │  Por setor: ████ UEI (12)     │
│  [card impedimento]      │             ███  HRGM (8)     │
│                          │  Ranking responsáveis         │
│                          │  Tendência (sparkline)        │
└──────────────────────────┴────────────────────────────────┘
```

### 7. Usuários (`/admin/usuarios`)
**Roles:** SUPER_ADMIN, DIRETORIA
**Layout:**

```
┌─ [Buscar...] [Filtro Role ▼] [+ Novo Usuário] ──────────┐
├─ Tabela ────────────────────────────────────────────────┤
│  Avatar │ Nome/Email │ Role Badge │ Unidades │ Escopo │ ⋯ │
│  [GS]   │ Gabriel S  │ DIRETORIA  │ UEI,HRGM │ MULTI  │ ⋯ │
└─────────────────────────────────────────────────────────┘
```

**Modal "Novo Usuário":** nome, email, senha, role, unidades (multi-select), escopo

---

## Componentes Reutilizáveis

### Atoms (`components/ui/`)
| Componente | Props | Uso |
|-----------|-------|-----|
| `Badge` | variant: role/status/scope, label | Role chips, status labels |
| `ProgressBar` | value, color | Progresso de metas e planos |
| `TrafficLight` | status: GREEN/YELLOW/RED | Farol em cards e listas |
| `Avatar` | name, size | Iniciais com fundo colorido |
| `Button` | variant: primary/ghost/danger, size | Ações gerais |
| `Modal` | title, children, onClose | Formulários, confirmações |
| `Spinner` | size | Loading states |

### Molecules (`components/shared/`)
| Componente | Uso |
|-----------|-----|
| `MetricCard` | Dashboard — número grande + tendência |
| `EmptyState` | Tabelas/listas vazias |
| `PageHeader` | Título + breadcrumb + ação primária |
| `FilterBar` | Busca + filtros combinados |

---

## Ordem de Implementação

### Fase 1 — Design Foundation (bloqueante)
1. `globals.css` — tokens CSS, fontes, Tabler Icons import
2. `tailwind.config.ts` — extend colors com os tokens
3. `Sidebar` — redesign completo (52px, dark green, icons)
4. `Header` — redesign (unit selector, notificações, avatar)

### Fase 2 — Componentes Base
5. `ui/Button`, `ui/Badge`, `ui/Modal`, `ui/Spinner`
6. `ui/ProgressBar`, `ui/TrafficLight`, `ui/Avatar`
7. `shared/MetricCard`, `shared/PageHeader`

### Fase 3 — Páginas (em ordem de prioridade)
8. Dashboard (`/dashboard`)
9. Processos / Planos (`/processos`)
10. Kanban (`/kanban/[boardId]`)
11. Impedimentos (`/impedimentos`)
12. Usuários admin (`/admin/usuarios`)

---

## Boas Práticas Frontend

### 1. Formulários — react-hook-form + zod

Todo formulário usa `react-hook-form` com schema `zod`. Nunca `useState` para campos de form.

```typescript
// Padrão obrigatório para todos os formulários
const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
})
```

Formulários a cobrir: Login, Novo Usuário, Nova Tarefa, Novo Plano, Nova Meta, Novo Grupo.

---

### 2. Loading States — Skeleton, não Spinner

Listas e cards usam skeleton screen (não spinner) quando `isLoading === true`.

```typescript
// CORRETO — skeleton que mantém o layout estável
if (isLoading) return <PlanListSkeleton />

// EVITAR — spinner que colapsa o layout
if (isLoading) return <Spinner />
```

Cada componente de lista tem um `*Skeleton` correspondente com `animate-pulse`.
Spinner aceito apenas em botões de submit (ação pontual, não página inteira).

---

### 3. Error Boundaries

Cada grupo de rota envolve o conteúdo em um `ErrorBoundary`. Erros de um widget não quebram o layout inteiro.

```
app/(auth)/
├── layout.tsx          ← <ErrorBoundary fallback={<PageError />}>
├── dashboard/
│   └── error.tsx       ← Next.js error boundary automático por rota
├── processos/
│   └── error.tsx
└── kanban/
    └── error.tsx
```

Usar `error.tsx` do App Router do Next.js — é o error boundary nativo da rota.

---

### 4. Acessibilidade (a11y)

| Regra | Exemplo correto |
|-------|----------------|
| HTML semântico | `<nav>`, `<main>`, `<button>`, nunca `<div onClick>` |
| Sidebar icon-only | `<button aria-label="Ir para Processos">` em cada ícone |
| Modais | Focus trap ao abrir + `Escape` fecha + `role="dialog"` |
| Cores | Nunca transmitir informação só por cor (farol = ícone + cor) |
| Formulários | `<label htmlFor>` em todo campo |
| Imagens decorativas | `alt=""` em ícones que têm label ao lado |

---

### 5. Performance — Lazy Load de Componentes Pesados

Kanban (drag-and-drop) e o chat (Socket.IO) não fazem sentido no servidor. Carregar sob demanda:

```typescript
// components/kanban/kanban-board.tsx
import dynamic from 'next/dynamic'

const KanbanBoard = dynamic(() => import('./kanban-board-client'), {
  ssr: false,
  loading: () => <KanbanBoardSkeleton />,
})
```

Regra: qualquer componente com `window`, `document`, drag libs, ou Socket.IO → `dynamic` com `ssr: false`.

---

### 6. TypeScript Estrito

`tsconfig.json` com `"strict": true`. Regras práticas:

```typescript
// PROIBIDO
const data: any = response.data
function foo(x: any) { }

// OBRIGATÓRIO
import type { Plan } from '@mediall/types'  // sempre `import type` para tipos
const data = response.data as Plan[]
```

Tipos de domínio vêm de `@mediall/types`. Nunca duplicar interfaces entre frontend e backend.

---

### 7. TanStack Query — Convenção de Query Keys

Keys hierárquicas e consistentes para cache correto e invalidação precisa:

```typescript
// Convenção: ['recurso', unitId, 'sub-recurso', id]
queryKey: ['plans', unitId]
queryKey: ['plans', unitId, planId, 'objectives']
queryKey: ['kanban', unitId, boardId]
queryKey: ['impediments', unitId]
queryKey: ['users']   // admin — sem unitId pois é global
```

Invalidação após mutação:
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['plans', unitId] })
}
```

---

### 8. Convenção de Arquivos de Componentes

```
components/ui/
├── button.tsx          ← export function Button(...)
├── button.test.tsx     ← testes unitários (Vitest)
└── index.ts            ← export { Button } from './button'
```

- Um componente por arquivo
- Nome do arquivo em kebab-case, componente em PascalCase
- `index.ts` em cada pasta para imports limpos: `import { Button } from '@/components/ui'`

---

## Checklist de Implementação

### Design Foundation
- [x] globals.css com CSS vars + Google Fonts + Tabler Icons
- [x] tailwind.config.ts extend com `gd`, `gm`, `gn`, `bg`, `gs`, `gx`
- [x] Sidebar redesenhada (52px, dark green, icon-only, neon active)
- [x] Header redesenhado (breadcrumb, unit selector MULTI, notificações, avatar)

### Componentes Base
- [x] `ui/Button`
- [x] `ui/Badge`
- [x] `ui/Modal`
- [x] `ui/Avatar`
- [x] `ui/ProgressBar`
- [x] `ui/TrafficLight`
- [x] `ui/Spinner`
- [x] `shared/MetricCard`
- [x] `shared/PageHeader`
- [x] `shared/EmptyState`

### Páginas
- [x] Dashboard completo
- [x] Processos / Planos Estratégicos
- [x] Kanban Board (Board + Lista + Calendário views, task detail modal, deps, checklists)
- [x] Impedimentos (analytics sidebar, resolve modal)
- [x] Usuários Admin
- [x] Mensagens / Chat (grupos sidebar + chat em tempo real)

### Login
- [x] Aplicar design tokens na tela de login

### Boas Práticas
- [x] `tsconfig.json` com `"strict": true`
- [x] `react-hook-form` + `zod` instalados
- [x] Schema zod para Login form
- [x] Schema zod para Novo Usuário form
- [x] Schema zod para Nova Tarefa form
- [x] `error.tsx` em `/processos` (Next.js error boundary)
- [ ] `error.tsx` em rotas restantes (kanban, impedimentos, mensagens)
- [x] Skeleton screens para Dashboard, Processos, Kanban
- [ ] Skeleton screens para Impedimentos (parcial)
- [x] Sidebar: `aria-label` em todos os botões icon-only
- [x] Modais com focus trap + Escape fecha
- [x] KanbanBoard com `dynamic({ ssr: false })`
- [x] Query keys seguindo convenção hierárquica
- [x] `index.ts` barrel em cada pasta de componentes

---

## Dependências a Instalar

```bash
# Frontend
npm install --save @tabler/icons-webfont
npm install --save react-hook-form zod @hookform/resolvers
npm install --save-dev @types/node
```

`next.config.js` — adicionar domínio fonts.googleapis.com se usar `next/font`.
Alternativa: CDN link no `app/layout.tsx` (mais simples para o MVP).
