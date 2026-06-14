# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Engineering Rules — read before implementing

Actionable, code-verified rules live in **`.claude/rules/`**. Read the relevant file **before**
writing any improvement, and respect rules marked **🔴 OBRIGATÓRIO** (blocking):

- **`.claude/rules/architecture.md`** — backend contexts, EventBus boundaries, Prisma multi-file, API contract, jobs
- **`.claude/rules/ui.md`** — feature-first layout, shared UI primitives, design tokens, forms, TanStack Query, loading/error
- **`.claude/rules/security.md`** — auth/session, CSRF, **per-unit data isolation (rule #1)**, secrets, uploads, RBAC

When a rule and the actual code disagree, the code wins — update the rule. See `.claude/rules/README.md`.

---

## Project Overview

**Mediall Brasil** — internal corporate platform for a healthcare holding with multiple units (UPAs, hospitals, etc.).

**Detailed planning documents live in `docs/`** — read them for domain context before implementing features.

**Monorepo layout:**
```
mediall/
├── apps/backend/      ← NestJS
├── apps/frontend/     ← Next.js
├── packages/types/    ← shared TypeScript types (@mediall/types)
├── docs/              ← all planning and architecture documents
├── turbo.json
└── package.json       ← npm workspaces root
```

---

## Commands

**From monorepo root:**
```bash
npm run dev                             # start frontend + backend in parallel (Turborepo)
npm run build                           # build all apps in dependency order
npm run lint                            # lint all apps
turbo run dev --filter=backend          # backend only
turbo run dev --filter=frontend         # frontend only
```

**Backend (from apps/backend/):**
```bash
npm run start:dev          # dev server with watch
npm run lint               # ESLint
npm run test               # unit tests
npm run test:e2e           # e2e tests
npx prisma migrate dev     # run pending migrations
npx prisma studio          # DB GUI
npx prisma generate        # regenerate client after schema changes
```

**Frontend (from apps/frontend/):**
```bash
npm run dev                # dev server
npm run build              # production build
npm run lint               # ESLint + TypeScript check
```

**Infrastructure:**
```bash
docker compose up -d            # start all services (from monorepo root)
docker compose logs -f nestjs   # tail API logs
```

---

## Naming Conventions — Critical

| Scope | Convention |
|-------|-----------|
| Functions, methods, variables | **English** — `createUser()`, `findAllPlans()`, `unitId` |
| DB tables and columns | **English, snake_case** — `strategic_plans`, `created_at`, `unit_id` |
| DTOs, interfaces, classes | **English** — `CreatePlanDto`, `JwtPayload`, `UsersService` |
| REST routes | **English** — `/api/plans`, `/api/units/:unitId/goals` |
| Prisma schema fields | **camelCase** mapped to snake_case via `@map` |
| Code comments | **English** |
| UI text shown to users | **Portuguese** |

---

## Architecture

### Monorepo Structure

Single repo, two apps, one shared types package. NestJS modules (`ChatModule`, `KanbanModule`, `MeetingsModule`, etc.) provide the service separation — no actual microservices, no network overhead between them.

Shared types live in `packages/types` and are imported by both apps as `@mediall/types`. Never duplicate type definitions between frontend and backend.

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ / React 18+ / TypeScript / Tailwind CSS |
| Backend | NestJS 10+ / TypeScript |
| ORM | Prisma 5+ |
| Database | PostgreSQL 16+ |
| Cache / Queues | Redis 7+ |
| Storage | MinIO (signed URLs, private buckets) |
| Video | LiveKit (WebRTC) |
| Auth | JWT in HttpOnly Cookie (15min access + 7d refresh) |
| HTTP Client | TanStack Query + Axios |
| Real-time | Socket.IO |
| Jobs | BullMQ + node-cron |
| Infra | Docker Compose + Nginx + Ubuntu Server 24.04 |

---

### Multi-Unit Data Isolation — Most Important Rule

Every query that returns data **must** filter by `unitId`. No exceptions.

```typescript
// WRONG
prisma.task.findMany()

// CORRECT
prisma.task.findMany({ where: { unitId: user.activeUnitId } })
```

`unitId` always comes from **route params**, never from the request body. The guard stack enforces this automatically.

---

### Backend Guard Stack

Applied globally in sequence to all protected routes:

```
JwtAuthGuard → RolesGuard → UnitScopeGuard
```

- **JwtAuthGuard** — validates JWT, rejects expired/invalid tokens
- **RolesGuard** — checks `@Roles()` decorator against `user.role`
- **UnitScopeGuard** — GLOBAL scope always passes; MULTI/SINGLE checks that route `unitId` is in `user.units[]`

### BaseUnitController

All controllers that operate on a unit extend this abstract class. It wires up the guard stack and sets the `units/:unitId` route prefix automatically.

```typescript
@Controller('units/:unitId')
@UseGuards(JwtAuthGuard, RolesGuard, UnitScopeGuard)
export abstract class BaseUnitController {}
```

### API Response Format

All API responses are wrapped by `TransformInterceptor`:

```json
{ "data": {}, "statusCode": 200, "timestamp": "..." }
```

### JWT Payload

```typescript
{ sub, email, role, accessScope: 'GLOBAL'|'MULTI'|'SINGLE', units: string[] }
```

`units[]` is embedded in the token to avoid a DB hit on every request.

---

### Strategic Hierarchy

```
StrategicPlan → Objective → Goal (OKR) → PlanPhase → MacroTask → Task (Kanban)
```

**Progress is always calculated bottom-up** — never set manually at parent levels:

```
Task:       0% or 100% (binary)
MacroTask:  (completed tasks / total) × 100
PlanPhase:  (completed macro tasks / total) × 100
Goal:       (completed phases / total) × 100
Objective:  average of goals
Plan:       average of objectives
```

### PlanPhase (sequential unlock)

Phases have status `LOCKED → ACTIVE → ARCHIVED`. Completing a phase automatically:
1. Archives the phase's Kanban board
2. Unlocks the next phase (`LOCKED → ACTIVE`)
3. Notifies responsible users of the next phase

A phase can have `unitScope: ALL | SPECIFIC | MATRIX` — when `ALL`, each unit gets its own parallel Kanban board.

---

### Access Scope Behavior

| Scope | Frontend behavior |
|-------|------------------|
| GLOBAL | Sees all units; free navigation; no selector |
| MULTI | Unit selector in header: `"Acessando: [UPA ▼]"`. Context changes completely when switching. |
| SINGLE | Lands directly in their unit; no selector |

Users can have different roles per unit (stored in `user_units` table).

---

### Impediment Escalation

When a task is marked `BLOCKED`:
- Day 0: notify responsible + immediate manager
- Day 2: escalate to sector manager
- Day 5: escalate to Diretoria with full history

`escalation_level` tracks the current escalation step. ATTENTION status is visible but does not block progress.

---

### Kanban Board Ownership

A `KanbanBoard` is owned by one of three entity types (`ownerType`):
- `PHASE` — one board per active phase
- `MACRO_TASK` — one board per macro task
- `GROUP` — one board per communication group

---

### Jobs (BullMQ + node-cron)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `impediment-escalation` | Daily 8h | Escalate unresolved impediments |
| `group-archive` | Daily 23:55 | Archive temporary groups past deadline |
| `task-checkin` | Configurable | Alert responsible users with no updates |
| `deadline-alert` | Daily 7h | Alert tasks due within 48h |
| `phase-unlock` | On-demand | Unlock next phase when previous completes |

---

### Database Conventions

- Primary keys: always `id UUID @default(uuid())`
- Foreign keys: `<entity>_id` — e.g., `plan_id`, `created_by`
- Audit fields on all tables: `created_at`, `updated_at`, `deleted_at` (soft delete)
- Boolean fields: `is_` or `has_` prefix — `is_active`, `has_attachment`
- Prisma: camelCase fields mapped to snake_case via `@map("snake_case")`
- `DB_SYNCHRONIZE` must be `false` in production — use `prisma migrate deploy`

---

### Frontend State Management

- **Zustand** — `authStore` (user session), `unitStore` (active unit), `uiStore` (sidebar/modals)
- **TanStack Query** — all data fetching, mutations, cache invalidation
- **Socket.IO** — real-time events (chat, notifications, Kanban updates)
- All queries needing `unitId` consume `unitStore.activeUnit`

### Server vs Client Components

| Type | When |
|------|------|
| Server Component | Initial page data (SSR, no loading spinner) |
| Client Component | Interactions, WebSocket, local state |
| TanStack Query | Refetch, mutations, post-load cache |

---

### Frontend Good Practices

- Forms: `react-hook-form` + `zod` — never raw `useState` for form fields
- Loading states: skeleton screens per component, spinner only on submit buttons
- Error boundaries: `error.tsx` in each authenticated route (Next.js App Router)
- Accessibility: semantic HTML, `aria-label` on icon-only buttons, focus trap in modals
- Heavy components (Kanban, drag-and-drop): `dynamic({ ssr: false })`
- TypeScript: `strict: true`, no `any`, always `import type` for types
- Query keys: hierarchical — `['plans', unitId]`, `['kanban', unitId, boardId]`
- Barrel exports: `index.ts` in every component folder

---

### Security Rules

- Bcrypt cost factor 12 for passwords
- Lock account after 5 failed login attempts (manual unlock by admin)
- Rate limit: 30 req/min on login endpoint
- MinIO buckets private; files served via signed URLs with expiry
- Docker containers run without root
- All mutations logged to `audit_log` table (user_id, unit_id, action, entity, IP)