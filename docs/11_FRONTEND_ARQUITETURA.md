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

## Estrutura de Pastas (Feature-based)

Três grandes blocos: **`app/`** (só rotas), **`features/`** (domínios), **`shared/`** (cross-feature).

```
apps/frontend/src/
├── app/                               ← Next.js App Router — só pages + layouts
│   ├── (public)/login/page.tsx
│   ├── (auth)/                        ← rotas autenticadas
│   │   ├── layout.tsx                 ← verifica JWT, redireciona se não auth
│   │   ├── dashboard/page.tsx
│   │   ├── processos/...              ← planos → objetivos → metas → etapas
│   │   ├── kanban/[boardId]/page.tsx
│   │   ├── mensagens/...
│   │   ├── agenda/page.tsx
│   │   ├── documentos/page.tsx
│   │   ├── chamados/page.tsx
│   │   ├── impedimentos/page.tsx
│   │   └── perfil/page.tsx
│   ├── (admin)/admin/usuarios|unidades/
│   └── middleware.ts                  ← proteção global de rotas
│
├── features/                          ← 15 domínios — cada um com hooks/ e components/
│   ├── auth/
│   ├── users/
│   ├── units/
│   ├── strategic/
│   ├── kanban/
│   ├── chat/
│   ├── meetings/
│   ├── transcription/
│   ├── documents/
│   ├── tickets/
│   ├── impediments/
│   ├── notifications/
│   ├── dashboard/
│   ├── reports/
│   └── audit/
│
└── shared/                            ← reutilizável entre features
    ├── ui/                            ← componentes base (Button, Input, Modal, Badge, Avatar...)
    ├── layout/                        ← Sidebar, Header, UnitSelector
    ├── hooks/                         ← useAuth, useUnit, useSocket
    ├── lib/                           ← api.ts (Axios), queryClient.ts, socket.ts, utils.ts
    └── store/                         ← Zustand: authStore, unitStore, uiStore
```

### Estrutura interna de cada feature

```
features/<domain>/
├── hooks/                             ← TanStack Query hooks (use-<domain>.ts)
├── components/                        ← componentes específicos do domínio
└── index.ts                           ← barrel export
```

### Regras de acoplamento

- `app/<route>/page.tsx` importa de `features/<X>/` e `shared/` — nunca de outra rota
- `features/X` pode importar **apenas** de:
  - `features/X/**` (próprio domínio)
  - `shared/**`
  - `@mediall/types`
- **Exceções controladas** (frontend tem mais flexibilidade que backend):
  - `features/X/hooks/use-users.ts` pode ser consumido por outra feature quando o dado é transversal (User aparece em todo lugar)
  - Caso a ser evitado: feature A importando componentes visuais de B. Solução: promover o componente para `shared/ui/` ou `shared/<algo>/`

### Tipos compartilhados com backend

Vêm de `packages/types`:
```typescript
import type { Plan, JwtPayload, KanbanTask } from '@mediall/types'
```

Não duplicar types entre frontend e backend.

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

### Setup
- [x] Monorepo (Turborepo + npm workspaces) — ver plano 12
- [x] Next.js 14+ com App Router
- [x] Tailwind CSS
- [x] TanStack Query
- [x] Zustand stores (`authStore`, `unitStore`, `uiStore`)
- [x] Axios com interceptors (token refresh)
- [x] Socket.IO client
- [x] Middleware de proteção de rotas
- [x] Reestruturação `features/` + `shared/` concluída (15 features)

### Componentização base
- [x] Componentes UI shared: `Button`, `Badge`, `Avatar`, `ProgressBar`, `TrafficLight`, `Modal`, `Spinner`, `Input`, `Select`, `Textarea`
- [x] Layout principal (3 colunas: sidebar, lista, conteúdo)
- [x] Seletor de unidade no header (MULTI scope)
- [x] `error.tsx` em rotas autenticadas

### Features implementadas (ver plano 14 — Roadmap)
- [x] Strategic (planos, objetivos, metas, etapas, modais de edição)
- [x] Kanban (board/lista/calendário, drag-and-drop, checklists, dependências)
- [x] Chat (grupos, mensagens, typing, reações, presença, conversas 1:1)
- [x] Meetings (videochamadas LiveKit, agenda, gravação)
- [x] Documents, Tickets, Impediments, Notifications, Dashboard, Reports

### Concluído — arquitetural (plano 17)
- [x] Boundary lint via dependency-cruiser (`.dependency-cruiser.cjs` + script `lint:boundaries`)
- [x] Auditoria das exceções: kanban → users (UserCombobox), kanban → chat (task-files reuso) documentadas como warnings legítimos

### Concluído — outras (plano 16)
- [x] Visualização Timeline (Gantt) no Kanban (`KanbanGanttView`)
- [x] Migração de formulários para `react-hook-form` + `zod` (4 forms: chamados, impedimentos, documentos, reuniões)
- [x] FormModal reutilizável (`components/ui/form-modal.tsx`) adotado pelos 4 forms
