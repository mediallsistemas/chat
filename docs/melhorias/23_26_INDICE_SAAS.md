# 23–26 — Índice SaaS: de plataforma interna a produto vendável

> **⚠️ Antes de implementar qualquer plano deste conjunto:** leia e siga **obrigatoriamente** as
> regras em [`.claude/rules/`](../../.claude/rules/) — em especial `architecture.md`, `security.md`
> e `ui.md`. Regras marcadas **🔴 OBRIGATÓRIO** são bloqueantes. Toda query respeita o isolamento
> por **tenant** e por **unit**. Se o código divergir da regra, **o código manda** — atualize a
> regra (ver `.claude/rules/README.md`).

> **Leia este arquivo antes de implementar os planos 23–26.** Eles transformam o sistema de
> uma plataforma single-tenant (uma holding) em um **SaaS multitenant revendável por assinatura
> mensal**, com um **painel de comando ("Jarvis")** e um **modelo de plano multi-unidade**.

Decisões já tomadas com o cliente (registradas para não re-litigar):

| Tema | Decisão |
|------|---------|
| **Isolamento multitenant** | DB compartilhado + `tenant_id` em tudo + **Prisma Extension** (auto-escopo) + **Postgres RLS** nas tabelas sensíveis. Evolui para DB dedicado no tier ENTERPRISE. |
| **Plano × Unidade** | Definição compartilhada, **execução por unidade**; atrelar a N unidades; excluir por unidade ou geral. |
| **Painel "Jarvis"** | **Centro de comando visual** (seletor de escopo + drill-down + ações inline). IA fica para depois. |
| **Ordem** | **Multitenant primeiro** (fundacional), depois plano multi-unidade, painel e billing. |

---

## Por que multitenant primeiro

O `tenant_id` toca **todo** model e **toda** query. Se fizermos plano multi-unidade ou o painel
antes, teríamos que refatorá-los de novo para encaixar o tenant. Fazendo a fundação primeiro,
os planos 24/25/26 já nascem tenant-aware. Custa mais no começo, evita retrabalho caro.

---

## Ordem de execução

```
FASE I — Fundação multitenant  (plano 23)  🔴 bloqueia tudo
└── 23.1 Tenant + tenant_id (backfill 1 tenant)  → 23.2 TenantGuard + JWT + CLS
    → 23.3 Prisma Extension (auto-escopo)         → 23.4 Subdomínio
    → 23.5 RLS (tabelas sensíveis)                → 23.6 Realtime/arquivos + platform + provisionamento

FASE II — Plano multi-unidade  (plano 24)  depende de 23
└── 24.1 schema PlanUnit  → 24.2 rotas definição+atribuição  → 24.3 visão por unidade
    → 24.4 frontend (multi-seleção, excluir por unidade/geral)  → 24.5 migração/seed

FASE III — Painel Jarvis  (plano 25)  depende de 24 (breakdown por unidade)
└── 25.1 seletor de escopo  → 25.2 drill-down  → 25.3 planos da holding
    → 25.4 cockpit da unidade  → 25.5 ações inline  → 25.6 filtros + realtime

FASE IV — Billing  (plano 26)  depende de 23
└── 26.1 schema  → 26.2 Stripe  → 26.3 webhook  → 26.4 BillingGuard+limites
    → 26.5 painel platform admin  → 26.6 billing do tenant

Paralelizável: FASE IV pode começar em paralelo à FASE II/III (ambas só dependem de 23).
```

---

## Dependências explícitas

```
23 (multitenant)        → deve existir antes de → 24, 25, 26  (todos precisam de tenant_id)
24 (plano multi-unidade)→ deve existir antes de → 25.3 (breakdown por unidade no painel)
23.6 (contexto platform)→ deve existir antes de → 26.5 (painel platform admin)
```

> 25 (painel) **pode** começar a parte de UX (25.1/25.2 — seletor e drill-down) sem o 24, mas o
> card de "planos da holding por unidade" (25.3) precisa do 24.

---

## Guard stack final (depois dos 4 planos)

```
JwtAuthGuard → TenantGuard → BillingGuard → RolesGuard → UnitScopeGuard
   (autentica)  (isola tenant) (assinatura)  (papel)      (unidade)
```

Cada camada tem uma responsabilidade única; juntas, garantem: usuário autenticado, do tenant
certo, com assinatura ativa, com papel suficiente, na unidade permitida.

---

## Mapa de conflitos (arquivos tocados por múltiplos planos)

### `apps/backend/prisma/schema/*.prisma`
| Ordem | Plano | O que muda |
|-------|-------|-----------|
| 1º | 23 | `_tenant.prisma` (Tenant) + `tenant_id` em todos os models + índices prefixados |
| 2º | 24 | `StrategicPlan` perde `unitId`; novo `PlanUnit`; (decisão) `unitId` de Objective/Goal |
| 3º | 26 | `Subscription`, `BillingEvent` (contexto platform/billing) |

Cada um gera sua migration, **em ordem**.

### `apps/backend/src/app.module.ts` (guards globais)
| Ordem | Plano | Adiciona |
|-------|-------|----------|
| 1º | 23 | `TenantGuard` como `APP_GUARD` (após `JwtAuthGuard`) + `nestjs-cls` module |
| 2º | 26 | `BillingGuard` como `APP_GUARD` (após `TenantGuard`) |

### `packages/types` (`@mediall/types`)
| Ordem | Plano | Adiciona |
|-------|-------|----------|
| 1º | 23 | `JwtPayload.tenantId`, `TenantStatus`, `PlanTier` |
| 2º | 24 | tipos de `PlanUnit`, contrato de atribuição |
| 3º | 26 | `SubscriptionStatus`, contratos de billing |

### `apps/backend/src/prisma/prisma.service.ts`
| Ordem | Plano | Adiciona |
|-------|-------|----------|
| 1º | 23 | `.$extends` com a query extension de auto-escopo por tenant |

### `apps/frontend/src/shared/store/unit-store.ts` + header
| Ordem | Plano | Adiciona |
|-------|-------|----------|
| 1º | 23 | resolução de tenant (subdomínio) no boot do app |
| 2º | 25 | `scope: 'ALL' \| 'UNIT'` + seletor de escopo para GLOBAL |

---

## Arquitetura AWS (alvo de produção)

```
Route53  *.app.com  ─┐
ACM wildcard cert    ├─▶ CloudFront ─▶ ALB ─▶ ECS Fargate (Next.js + NestJS)
                     │                              │
                     │                              ├─▶ RDS/Aurora Postgres (DB compartilhado + RLS)
                     │                              │      └ tenant ENTERPRISE → instância dedicada
                     │                              ├─▶ ElastiCache Redis (sessão socket + BullMQ + cache)
                     │                              └─▶ S3 (ou MinIO) — chave prefixada por tenant
Stripe ──webhook──▶ ALB ─▶ /platform/billing/webhook
```

- **Subdomínio por tenant** resolvido por wildcard DNS + cert; o app lê o host e mapeia → `slug`.
- **1 RDS** atende todos os tenants (custo baixo); RLS dá isolamento no banco. Enterprise migra
  para instância dedicada sem mudar o app (mesma string de conexão por tenant, roteada).
- **Containers sem root** (`security.md`), secrets via AWS Secrets Manager → env (sem fallback).
- **Backups:** snapshot do RDS; para enterprise com DB dedicado, backup/restore por cliente.

---

## Custos e segurança — a lógica da escolha de isolamento

| | DB compartilhado + RLS (escolhido) | DB por tenant |
|---|---|---|
| **Custo base** | 1 RDS para N clientes → barato, escala linear suave | N RDS → custo por cliente |
| **Onboarding** | 1 INSERT (instantâneo) | provisionar DB (minutos, automação) |
| **Migração** | 1 migration para todos | N migrations |
| **Isolamento** | app (extension) + banco (RLS) — forte | físico — máximo |
| **Quando usar** | maioria dos clientes (SMB, holdings médias) | enterprise que exige no contrato |

**Modelo híbrido (recomendado):** começa todo mundo no compartilhado; o tier ENTERPRISE
(plano 26) "compra" um DB dedicado. Melhor relação custo×segurança×venda.

---

## Checklist macro

### Fase I — Multitenant (23) — ✅ **CONCLUÍDO (código) · movido para [`concluidos/`](../melhorias_concluidos/23_multitenancy_saas.md)**
> Isolamento por tenant **entregue e ativo na aplicação**. Pendências = **deploy / pré-2º-tenant** (runbook no doc do 23): ativar RLS (role+GUC), `tenant_id NOT NULL`, rooms de socket por tenant, DNS wildcard. Provisionamento/onboarding re-escopado p/ plano 26.
- [x] 23.1 Tenant + tenant_id + backfill ✅ (migration aplicada; backfill rodou — 2476 linhas)
- [x] 23.2 TenantGuard + JWT.tenantId + contexto ALS ✅ (AsyncLocalStorage nativo, **não** nestjs-cls)
- [x] 23.3 auto-escopo ✅ (middleware **`$use`**, não client extension; `findUnique` pós-filtrado; transição-safe tenant-OR-null)
- [~] 23.4 Subdomínio: host check em `TenantGuard` + `tenantSlug` no JWT ✅ · Route53/Nginx wildcard = deploy (pendente)
- [~] 23.5 RLS habilitada no DB (FORCE + policy `tenant_isolation`, 36 tabelas, migration `20260616010000_enable_rls`) ✅ · **inerte sob superuser** — ativação (role `mediall_app` + GUC) e `tenant_id` NOT NULL = pendente (runbook no plano 23)
- [~] 23.6 **chave de arquivo por tenant ✅** (`files.controller`); **deploy/pré-2º-tenant:** rooms de socket por tenant (refactor de evento→handler→emit; risco sem benefício com 1 tenant); **contexto platform + provisionamento → plano 26**
- [x] (gap) seed.ts cria tenant + atribui tenant_id ✅ (`ensureTenantAndBackfill`, evita quebrar login no re-seed)

### Fase II — Plano multi-unidade (24)
- [x] 24.1 schema `PlanUnit` (N:N plano↔unidade) + backfill ✅ (migration `20260616020000_add_plan_units`, 7 linhas; **aditivo** — `StrategicPlan.unitId` mantido como origem, remoção fica para fase posterior)
- [x] 24.2 backend ✅ — `PlansAdminController` (`@Controller('plans')`, tenant-scoped): `GET /plans`, `GET/POST /plans/:id/units` (attach), `DELETE /plans/:id/units/:unitId` (detach), `DELETE /plans/:id` (soft-delete via `deletedAt`). `/units/:unitId/plans` lê via `PlanUnit`. Testado E2E (attach→2 unidades, detach→1). **Fan-out de PhaseScopeBoard fica para 24.3.**
- [x] 24.3 ✅ — **execução por unidade (Modelo B: subárvore por unidade)**. `attachUnits` faz **fan-out**: clona a estrutura do plano (objetivos→metas→etapas+board/colunas→macro) da unidade de origem para cada unidade nova, com **execução zerada** (1ª etapa ACTIVE, demais LOCKED, sem tarefas). `detachUnit` faz **cleanup** da subárvore daquela unidade (tarefas+filhas→macro→etapas→boards/colunas→metas→objetivos), preservando as outras. **Progresso/farol por unidade** recalculado no `PlanUnit` (`recalcPlanUnit`, derivado dos objetivos da unidade) — write-through em `listUnits`/`findAll`. `findAll`/`findOne` agora filtram objetivos por `unitId`. **Sem mudança de schema/migration** (PlanUnit já existia). *(Modelo A — definição única "edita-1-vez" — fica como norte futuro; o stack inteiro é unit-scoped, então B casa com backend+frontend sem refator.)*
- [x] 24.4 frontend ✅ — `EditPlanModal` ganhou seção "Unidades onde o plano vale": lista as atreladas com remover (detach, bloqueia última), chips p/ adicionar a outras unidades (attach), e danger zone "Excluir plano (todas as unidades)" com confirmação inline. Hooks `usePlanUnits/useAttachPlanUnits/useDetachPlanUnit/useDeletePlan`. `tsc` OK. *(Multi-seleção no CREATE deferida — gerencia-se no edit; fan-out de boards é 24.3.)*
- [x] 24.5 ✅ — **seed consolidado**: `seed-strategic.ts` agora cria **1 `StrategicPlan`** (origem = 1ª unidade) atrelado às **6 unidades** via `PlanUnit`, com **subárvore de execução própria por unidade** (objetivos/metas/etapas/boards/macro/tasks, `unitId` por unidade) — em vez de 6 planos separados. Limpeza idempotente remove instâncias antigas do plano (todas as unidades) antes de re-semear. `ensureTenantAndBackfill` no fim (tenant_id). Cópia humana do plano em [`docs/planos_estrategicos/gerencia-medica-2026.md`](../planos_estrategicos/gerencia-medica-2026.md). **Ainda não rodado** (há WIP de billing/plano-26 não-commitado na árvore + `prisma generate` pendente desse WIP — rodar `npx ts-node prisma/seed-strategic.ts` quando a árvore estabilizar). `StrategicPlan.unitId` mantido como origem (remoção fica p/ depois).

### Fase III — Painel Jarvis (25) — ✅ **CONCLUÍDO (código, 2026-06-21)**
- [x] 25.1 seletor de escopo (GLOBAL+holding)
- [x] 25.2 drill-down grid→unidade
- [x] 25.3 card planos da holding por unidade ✅ — `/dashboard/summary` inclui `attachedUnits` por plano (via `PlanUnit`), filtra por atribuição (não-global) + `deletedAt: null`; grid de unidades conta planos por **atribuição**. Painel renderiza chips das unidades por plano. (Progresso por unidade ainda é o do plano — boards por unidade = 24.3, adiado.)
- [x] 25.4 cockpit da unidade  ← rota/endpoint já existiam; "Entrar no contexto desta unidade" + drill-down p/ planos add em 25.2
- [x] 25.5 ações inline + RBAC ✅ — resolver impedimento (com notas) + arquivar + **excluir plano (geral)** + **escalar manual** (`PATCH /units/:unitId/impediments/:id/escalate`, RBAC-gated, confirmação em Modal). O escalonamento reusa `ImpedimentEscalatedEvent` → notificações de gestão + `dashboard:update` + **war-room: aviso automático no grupo da equipe (plano 22)**, fechando o "war-room" sem rota nova. Cap no nível 2 (Diretoria). `EscalateImpedimentButton` no painel.
- [x] 25.6 filtros + realtime estendido ✅ — filtros do painel (busca/farol/tipo, em memória) + bridge `dashboard:update`; agora cobre **ativar/arquivar/excluir plano** via novo `PlanStatusChangedEvent` (`plans.service` emite em activate/archive/softDelete; `realtime-event.handler` faz fan-out por unidade afetada — delete emite para todas as `PlanUnit`) além de `impediment.*`/`phase.*` que já existiam.

### Fase IV — Billing (26) — ✅ **código (2026-06-21); falta Stripe go-live (keys/pacote)**
- [x] 26.1 schema Subscription/BillingEvent ✅ — models + enums (`SubscriptionStatus`/`PlanTier`) + migration `20260621000000_billing` + `TIER_LIMITS` em `@mediall/types`.
- [x] 26.2 Stripe (signup + trial) ✅ — **signup público de tenant** (`POST /auth/signup`, `@Public`, rate-limit 3/min): cria `Tenant` (TRIAL +14d) + admin (GLOBAL/`SUPER_ADMIN`) + unidade `MATRIZ` + `Subscription` TRIALING, e já loga (cookie). Front `(public)/signup` + link no login + middleware. **Trial sem cartão**; o customer/checkout do Stripe liga depois pelo portal (26.6). **Go-live pendente:** `npm i stripe` + keys (`BILLING_ENABLED`, `STRIPE_*`).
- [x] 26.3 webhook (idempotente) ✅ — `POST /platform/billing/webhook` raw body + verificação de assinatura + dedupe `BillingEvent.providerEventId`.
- [x] 26.4 BillingGuard + limites de tier ✅ — guard global (somente-leitura sob SUSPENDED/CANCELED, `@AllowSuspended`) + `maxUnits`/`maxUsers` em units/users.
- [x] 26.5 painel platform admin ✅ — `contexts/platform/tenants` (`PlatformAdminGuard`) + front `(platform)/platform/tenants` (mudar tier/suspender/impersonar **auditado**) + **banner de impersonação** sempre visível no app do tenant (`ImpersonationBanner`, marcador `impersonatedTenantName` no JWT/`/auth/me`, "Sair" = logout).
- [x] 26.6 billing do tenant ✅ — `/configuracoes/assinatura` (`GET /billing/me`, portal/checkout) + `SubscriptionStatusBanner`.
- [ ] resíduos (não-bloqueantes): e-mail nos eventos `tenant.suspended/reactivated/tier_changed` (eventos publicados, sem handler); métricas MRR/churn; tier ENTERPRISE (DB dedicado/SSO).

---

## Regras `.claude` a atualizar ao concluir

- **security.md** — nova seção "Isolamento por tenant" (irmã da regra nº1); guard stack atualizado.
- **architecture.md** — `_tenant.prisma`, Prisma Extension, contexto `platform`, guard stack.
- **ui.md** — §9: seletor de unidade para GLOBAL + escopo "toda a holding"; rotas `(platform)`.

> Lembrete da casa: quando a regra divergir do código, **o código manda** — atualize a regra.
