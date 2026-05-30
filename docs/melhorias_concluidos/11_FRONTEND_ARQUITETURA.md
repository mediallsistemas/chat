# Plano 11 — Arquitetura Frontend
## Next.js, estrutura de pastas, rotas, componentes

---

## Objetivo
Definir a arquitetura frontend com Next.js App Router, organização de pastas, proteção de rotas e padrões de componentes.

---

## Convenções de Nomenclatura

- **Funções e hooks**: inglês — `fetchPlans()`, `useGoalStore()`, `handleSubmit()`
- **Componentes React**: inglês — `PlanCard`, `GoalProgressBar`, `KanbanBoard`
- **Variáveis e props**: inglês — `planId`, `isLoading`, `onSuccess`
- **Nomes de arquivos**: inglês — `plan-card.tsx`, `use-auth.ts`, `api.ts`
- **Interfaces e tipos TypeScript**: inglês — `Plan`, `GoalWithPhases`, `UserSession`
- **Comentários no código**: inglês
- **Textos exibidos ao usuário (labels, botões, mensagens)**: português

---

## Localização no Monorepo

```
mediall/
└── apps/
    └── frontend/       ← raiz deste app
        ├── src/
        └── package.json
```

Tipos compartilhados com o backend vêm de `packages/types`:
```typescript
import type { Plan, JwtPayload } from '@mediall/types'
```

---

## Estrutura de Pastas

```
apps/frontend/src/
├── app/
│   ├── (public)/
│   │   └── login/
│   │       └── page.tsx
│   │
│   ├── (auth)/                         ← rotas autenticadas
│   │   ├── layout.tsx                  ← verifica JWT, redireciona se não auth
│   │   ├── dashboard/
│   │   │   └── page.tsx                ← painel da diretoria
│   │   ├── processos/
│   │   │   ├── page.tsx                ← lista de planos
│   │   │   └── [planId]/
│   │   │       ├── page.tsx            ← detalhe do plano
│   │   │       └── [objectiveId]/
│   │   │           └── [goalId]/
│   │   │               └── page.tsx    ← metas e etapas
│   │   ├── kanban/
│   │   │   └── [boardId]/
│   │   │       └── page.tsx
│   │   ├── mensagens/
│   │   │   ├── page.tsx                ← lista de grupos
│   │   │   └── [groupId]/
│   │   │       └── page.tsx            ← chat do grupo
│   │   ├── agenda/
│   │   │   └── page.tsx
│   │   ├── arquivos/
│   │   │   └── page.tsx
│   │   └── perfil/
│   │       └── page.tsx
│   │
│   ├── (admin)/                        ← apenas SUPER_ADMIN e DIRETORIA
│   │   ├── layout.tsx
│   │   └── admin/
│   │       ├── usuarios/
│   │       └── unidades/
│   │
│   └── middleware.ts                   ← proteção global de rotas
│
├── components/
│   ├── ui/                             ← componentes base (Button, Input, Modal...)
│   ├── layout/                         ← Sidebar, Header, UnitSelector
│   ├── kanban/                         ← KanbanBoard, KanbanCard, KanbanColumn
│   ├── strategic/                      ← PlanCard, ObjectiveCard, PhaseBlock
│   ├── chat/                           ← MessageList, MessageInput, GroupList
│   ├── dashboard/                      ← TrafficLight, ProgressBar, ImpedimentMap
│   └── shared/                         ← Avatar, Badge, Tooltip, EmptyState
│
├── hooks/
│   ├── useAuth.ts
│   ├── useUnit.ts                      ← contexto da unidade ativa
│   ├── useSocket.ts
│   └── useNotifications.ts
│
├── lib/
│   ├── api.ts                          ← instância Axios configurada
│   ├── queryClient.ts                  ← TanStack Query config
│   └── socket.ts                       ← Socket.IO client
│
├── store/
│   ├── authStore.ts                    ← Zustand: usuário autenticado
│   ├── unitStore.ts                    ← Zustand: unidade ativa selecionada
│   └── uiStore.ts                      ← Zustand: sidebar, modais
│
└── types/
    ├── auth.ts
    ├── strategic.ts
    ├── kanban.ts
    └── chat.ts
```

---

## Middleware de Proteção de Rotas

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')

  // Rota pública — deixa passar
  if (isPublicRoute(request.pathname)) return NextResponse.next()

  // Sem token — redireciona para login
  if (!token) return NextResponse.redirect('/login')

  const { role, accessScope, units } = decodeJWT(token.value)

  // Rota admin — verifica role
  if (isAdminRoute(request.pathname)) {
    if (!['SUPER_ADMIN', 'DIRETORIA'].includes(role)) {
      return NextResponse.redirect('/dashboard')
    }
  }

  // Rota com unitId — verifica acesso
  const unitId = extractUnitId(request.pathname)
  if (unitId && accessScope !== 'GLOBAL') {
    if (!units.includes(unitId)) {
      return NextResponse.redirect('/dashboard')
    }
  }

  return NextResponse.next()
}
```

---

## Seletor de Unidade (usuários MULTI)

Componente no header que aparece apenas para usuários com `accessScope = MULTI`:

```typescript
// store/unitStore.ts (Zustand)
interface UnitStore {
  activeUnit: Unit | null
  setActiveUnit: (unit: Unit) => void
}
```

Toda query que precisa de `unitId` consome `unitStore.activeUnit`.

---

## Server Components vs Client Components

| Tipo | Quando usar |
|------|------------|
| Server Component | Dados iniciais de página (SSR sem spinner) |
| Client Component | Interações, WebSocket, estado local |
| TanStack Query | Refetch, mutações, cache pós-carregamento |

**Exemplo prático:**
- Listagem de planos estratégicos → Server Component (carrega no servidor)
- Kanban com drag-and-drop → Client Component
- Chat em tempo real → Client Component + Socket.IO

---

## Padrões de Componentes

**Sempre componentizar:**
- KanbanBoard — reutilizado em grupos, etapas e tarefas macro
- PhaseBlock — bloco de etapa com status LOCKED/ACTIVE/ARCHIVED
- TrafficLight — farol verde/amarelo/vermelho
- ProgressBar — barra de progresso com percentual

**Convenções:**
- Componentes em PascalCase
- Hooks customizados prefixados com `use`
- Tipos sempre importados de `/types`
- Nunca usar `any`

---

## Checklist de Implementação

- [x] Configurar monorepo (Turborepo + npm workspaces) — ver `12_BACKEND_ARQUITETURA.md`
- [x] Setup Next.js 14+ com App Router
- [x] Configurar Tailwind CSS
- [x] Configurar TanStack Query
- [x] Configurar Zustand stores
- [x] Configurar Axios com interceptors (token refresh)
- [x] Configurar Socket.IO client
- [x] Implementar middleware.ts de proteção de rotas
- [x] Layout principal (3 colunas: sidebar, lista, conteúdo)
- [x] Seletor de unidade no header
- [x] Componentes base de UI — `Button`, `Badge`, `Avatar`, `ProgressBar`, `TrafficLight`, `Modal`, `Spinner`, `Input`, `Select`, `Textarea`
- [x] Componente `PhaseTimeline` (timeline visual de etapas LOCKED/ACTIVE/ARCHIVED)
- [x] Página `/processos` com integração API real (planos → objetivos → metas → etapas)
- [x] Componentes Kanban: `KanbanCard`, `KanbanColumn`, `KanbanBoard` (drag-and-drop com `react-beautiful-dnd`, `dynamic ssr:false`), `KanbanBoardSkeleton`, `CreateTaskModal`
- [x] Página `/processos/[planId]/[objectiveId]/[goalId]` — detalhe de meta com timeline de etapas e Kanban ativo
- [x] `error.tsx` em `/processos`
- [x] Modais de edição para plano, objetivo, meta e etapa (`EditPlanModal`, `EditObjectiveModal`, `EditGoalModal`, `EditPhaseModal`)
- [x] PATCH endpoints para plano, objetivo, meta e etapa (backend)
- [x] Visualizações: Lista e Calendário (KanbanBoardClient toggle Board/Lista/Calendário)
- [x] Visualização: Timeline (Gantt) — KanbanGanttView implementado em kanban-gantt-view.tsx
- [x] Painel da diretoria
- [x] Chat em tempo real (Socket.IO grupos + mensagens + typing indicator)
