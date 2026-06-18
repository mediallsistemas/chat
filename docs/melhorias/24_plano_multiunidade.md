# 24 — Plano em múltiplas unidades: definição compartilhada, execução por unidade

> **⚠️ Antes de implementar este plano:** leia e siga **obrigatoriamente** as regras em
> [`.claude/rules/`](../../.claude/rules/) — em especial `architecture.md`, `security.md` e
> `ui.md`. Regras marcadas **🔴 OBRIGATÓRIO** são bloqueantes. Toda query respeita o isolamento
> por **tenant** e por **unit**. Se o código divergir da regra, **o código manda** — atualize a
> regra (ver `.claude/rules/README.md`).

**Prioridade:** 🟡 Alta — corrige a dor central de gestão ("um plano não é de todas as unidades")
**Tempo estimado:** ~24–32h (faseável)
**Área:** Backend (strategic: plans/objectives/goals/phases), Frontend (processos, admin), Migração de dados
**Pré-requisito:** [23](23_multitenancy_saas.md) (multitenant) — planos passam a ser **tenant-scoped**.

> **Decisão tomada (modelo):** **Definição compartilhada, execução por unidade.** Um plano é
> definido uma vez (no tenant) e **atrelado a N unidades escolhidas no admin**. Cada unidade
> executa sua própria cópia (boards/tarefas), com progresso por unidade + agregado. Dá para
> **desvincular/deletar de uma unidade** ou **excluir o plano inteiro**.

---

## O problema (verificado no código)

Hoje `StrategicPlan.unitId` amarra **um plano = uma unidade** ([strategic.prisma:12](../../apps/backend/prisma/schema/strategic.prisma)).
"Gerência Médica 2026" aparecendo em 6 unidades = **6 linhas independentes** (duplicadas no
`seed-strategic.ts`). Consequências:
- Não existe "um plano usado em algumas unidades" — só cópias soltas.
- Editar o plano = editar 6 vezes. Sem visão de "como está esse plano na holding".
- Não dá para "deletar de uma unidade vs geral" — não há o conceito de plano compartilhado.

**Tensão no schema atual:** já existe `PhaseScopeBoard` (uma fase → várias unidades → um board por
unidade) e o hook `usePhaseScopeProgress` que calcula **progresso por unidade**
([use-strategic.ts:248-255](../../apps/frontend/src/features/strategic/hooks/use-strategic.ts)).
Ou seja, **a metade "execução por unidade" já existe** — mas brigando com o `StrategicPlan.unitId`
1:1. Este plano resolve a contradição: **um plano → muitas unidades**, reaproveitando o fan-out
de boards que já está lá.

---

## Modelo-alvo

```
StrategicPlan (DEFINIÇÃO — tenant-scoped, sem unit fixa)
  ├─ PlanUnit (atribuição) ─── quais unidades usam este plano  ← NOVO (join N:N)
  │     • UPA Zona Sul   → progresso 40%, farol 🟡   (cache por unidade)
  │     • HRGM           → progresso 24%, farol 🔴
  │
  ├─ Objective / Goal / PlanPhase (DEFINIÇÃO compartilhada)
  │
  └─ EXECUÇÃO por unidade = PhaseScopeBoard (board por fase × unidade)  ← JÁ EXISTE
        └─ Task (já tem unitId)  → rola progresso bottom-up por unidade
```

Princípio: **definição é uma só** (objetivos, metas, fases); **execução é por unidade** (cada
unidade tem seus boards e tarefas para a mesma fase). O progresso de cada unidade sobe
bottom-up dos boards daquela unidade (cálculo que o sistema **já faz**), e o progresso do plano
"na holding" é o agregado das unidades atreladas.

---

## Mudanças de schema

### 1. `StrategicPlan`: deixa de ser mono-unidade

```prisma
model StrategicPlan {
  id        String     @id @default(uuid())
  tenantId  String     @map("tenant_id")        // do plano 23
  name      String
  year      Int
  // ...vision/mission/values/status...
  // unitId   REMOVIDO  → o vínculo agora é via PlanUnit
  createdBy String     @map("created_by")

  tenant     Tenant      @relation(fields: [tenantId], references: [id])
  units      PlanUnit[]                          // ← NOVO
  objectives Objective[]

  @@index([tenantId])
  @@map("strat_plans")
}
```

### 2. `PlanUnit` — a tabela de atribuição (espelha o padrão `PhaseScopeBoard`)

```prisma
model PlanUnit {
  id           String       @id @default(uuid())
  tenantId     String       @map("tenant_id")
  planId       String       @map("plan_id")
  unitId       String       @map("unit_id")
  status       PlanStatus   @default(DRAFT)              // status do plano NAQUELA unidade
  progressPct  Decimal      @default(0) @map("progress_pct")   // cache do rollup por unidade
  trafficLight TrafficLight @default(GRAY) @map("traffic_light")
  attachedAt   DateTime     @default(now()) @map("attached_at")
  attachedBy   String       @map("attached_by")

  plan StrategicPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  unit Unit          @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@unique([planId, unitId])     // um vínculo por (plano, unidade)
  @@index([tenantId, unitId])
  @@map("strat_plan_units")
}
```

> **Decisão de design:** `status` e `progressPct` ficam **por unidade** no `PlanUnit`, não no
> `StrategicPlan`. Assim "UPA já ativou e está em 40%, HRGM ainda em rascunho" é representável.
> O farol/progresso do plano "na holding" é derivado (agregado) das linhas de `PlanUnit`.

### 3. `Objective` / `Goal`: definição compartilhada

`Objective.unitId` e `Goal.unitId` hoje existem porque o plano era mono-unidade. Como a
**definição** passa a ser compartilhada, há duas opções — **decisão a confirmar na fase 24.1**:

- **(A) Recomendada — definição sem unit, progresso por unidade derivado dos boards.**
  Remover `unitId` de `Objective`/`Goal` (viram puramente definição, tenant-scoped). O
  `progressPct`/`trafficLight` por unidade são **calculados** a partir dos `PhaseScopeBoard`
  daquela unidade (o `usePhaseScopeProgress` já faz isso por fase; somar por meta/objetivo).
  Mais limpo, sem duplicação, alinhado ao "progresso é sempre bottom-up" (`CLAUDE.md`).

- **(B) Alternativa — manter `unitId` e materializar progresso por (entidade, unidade)** numa
  tabela `GoalUnitProgress`. Mais tabelas, mais escrita, mas leitura de progresso por unidade
  fica O(1). Só vale se o cálculo on-the-fly de (A) ficar pesado em escala.

> Recomendo começar por **(A)** com cache no `PlanUnit.progressPct` (recalculado quando uma
> task/fase muda — o sistema já dispara `DashboardUpdatedEvent` no recálculo; aproveitar o mesmo
> gatilho para atualizar `PlanUnit`).

---

## Comportamento das ações (o que você pediu)

| Ação | O que acontece |
|------|----------------|
| **Criar plano e selecionar unidades** | Cria `StrategicPlan` (definição) + uma linha `PlanUnit` por unidade marcada. Para cada fase existente, cria os `PhaseScopeBoard` daquela unidade (fan-out de execução). |
| **Atrelar mais uma unidade depois** | Adiciona `PlanUnit` + cria os boards daquela unidade para as fases atuais. A unidade "entra" no plano sem afetar as outras. |
| **Excluir o plano de UMA unidade** | Remove o `PlanUnit` daquela unidade → `onDelete: Cascade` derruba os `PhaseScopeBoard`/tarefas **só dela**. As outras unidades seguem intactas. |
| **Excluir o plano (geral)** | Soft-delete do `StrategicPlan` → cascata em todos os `PlanUnit` e execução. Some da holding inteira. |
| **Ativar/arquivar por unidade** | Muda `PlanUnit.status` daquela unidade (não do plano global). |

---

## API (rotas)

A definição do plano passa a ser **tenant-scoped**; a visão/execução continua **por unidade**.

```
# Definição (admin do tenant)
POST   /plans                         cria a definição (tenant via contexto)
GET    /plans                         lista todos os planos do tenant (visão holding)
GET    /plans/:planId                 definição + lista de unidades atreladas + progresso por unidade
PATCH  /plans/:planId                 edita a definição (1 lugar, reflete em todas as unidades)
DELETE /plans/:planId                 exclui geral (soft-delete + cascata)

# Atribuição a unidades
POST   /plans/:planId/units           body: { unitIds: string[] }  → atrela + cria boards
DELETE /plans/:planId/units/:unitId   desatrela de UMA unidade (cascata só dela)

# Visão por unidade (continua existindo, agora filtrando por atribuição)
GET    /units/:unitId/plans           planos ATRELADOS àquela unidade (via PlanUnit)
GET    /units/:unitId/plans/:planId   execução do plano naquela unidade (boards/progresso dela)
PATCH  /units/:unitId/plans/:planId/activate|archive   muda PlanUnit.status daquela unidade
```

> **Compatibilidade:** `GET /units/:unitId/plans` muda de `where: { unitId }` para
> `where: { units: { some: { unitId } } }` (planos atrelados àquela unidade). O front de
> `/processos` (que usa esse endpoint) continua funcionando, agora mostrando os planos
> compartilhados que incluem a unidade ativa.

> **Permissão:** criar/editar/excluir **definição** = papel de tenant alto (`SUPER_ADMIN`,
> `DIRETORIA`) — como hoje em [plans.controller.ts:29](../../apps/backend/src/contexts/strategic/plans/plans.controller.ts).
> A definição é tenant-scoped, então essas rotas **não** estendem `BaseUnitController`; usam o
> `TenantGuard` + `@Roles`. As rotas `/units/:unitId/...` continuam em `BaseUnitController`.

---

## Frontend

### Admin: seletor de unidades ao criar/editar plano
- O `CreatePlanModal`/`EditPlanModal` ([create-plan-modal.tsx](../../apps/frontend/src/features/strategic/components/create-plan-modal.tsx))
  ganham um campo **multi-seleção de unidades** (checkbox list / multi-combobox), reusando o
  padrão `UserCombobox` (`ui.md` §2). Marca as unidades onde o plano vale.
- Botão "Excluir desta unidade" e "Excluir plano (todas)" no `EditPlanModal`, cada um com
  `Modal` de confirmação (`ui.md` §7.6 — nada de `confirm()` nativo).

### `/processos`: passa a mostrar planos compartilhados
- Hoje filtra pela unidade ativa do `unitStore`. Com o novo modelo, lista os planos **atrelados**
  à unidade ativa. O detalhe do plano mostra a execução **daquela** unidade.
- A visão "holding" (todos os planos, com breakdown por unidade) vai para o **painel Jarvis**
  (plano [25](25_painel_jarvis_command_center.md)) — é lá que mora o cross-unit.

### Query keys (`ui.md` §5)
- Definição: `['plans', tenantId]`, `['plans', tenantId, planId]`.
- Por unidade: `['plans', 'unit', unitId]` (atrelados à unidade).
- Invalidar ambos ao atrelar/desatrelar.

---

## Migração de dados (planos duplicados → compartilhados)

Os 6 "Gerência Médica 2026" hoje são cópias. Script de consolidação (opcional, para o tenant
Mediall existente):
1. Agrupar planos por `(name, year)` dentro do tenant.
2. Eleger 1 como a definição canônica; criar `PlanUnit` para cada unidade dos duplicados.
3. Re-apontar a execução (boards/tarefas) para a definição canônica.
4. Soft-delete dos duplicados.

> **Decisão a confirmar:** consolidar os existentes (script acima) **ou** deixar o legado como
> está e só aplicar o novo modelo a planos novos. Recomendo consolidar para o seed/demo, com o
> script versionado e idempotente. Atualizar `seed-strategic.ts` para já criar **1 plano atrelado
> a N unidades** em vez de 6 cópias.

---

## Faseamento

| Fase | Entrega | Esforço |
|---|---|---|
| 24.1 | Schema: `PlanUnit`, `StrategicPlan` sem `unitId`, decisão (A)/(B) de Objective/Goal + migration | ~8h |
| 24.2 | Backend: rotas de definição tenant-scoped + atribuição (`/plans/:id/units`) + fan-out de boards no attach | ~8h |
| 24.3 | Backend: `GET /units/:unitId/plans` por atribuição + status/progresso por unidade + recálculo do cache no `PlanUnit` | ~6h |
| 24.4 | Frontend: multi-seleção de unidades nos modais + excluir por unidade/geral + `/processos` adaptado | ~8h |
| 24.5 | Migração/consolidação dos planos duplicados + seed novo | ~4h |

---

## Regras `.claude` que este plano respeita

- **security.md §5** — `/units/:unitId/plans` continua filtrando por unidade (agora via relação
  `units.some.unitId`); definição tenant-scoped passa pela extension do plano 23.
- **architecture.md §2** — rotas de unidade herdam `BaseUnitController`; rotas de definição usam
  `TenantGuard` + `@Roles`.
- **architecture.md §3** — recálculo de progresso por unidade publica/consome evento (reusar o
  `DashboardUpdatedEvent` já existente), não chama contexto direto.
- **ui.md §2/§4/§7** — modais com `FormModal`/`Modal`, confirmação de exclusão sem `confirm()`,
  multi-seleção com primitivo existente.
- **CLAUDE.md (progresso bottom-up)** — progresso por unidade derivado dos boards, nunca setado à mão.

---

## Riscos e cuidados

- **Cascata de exclusão por unidade** (`PlanUnit onDelete: Cascade`): garantir que derruba **só**
  os boards/tarefas daquela unidade, não da definição compartilhada. Testar com 2 unidades.
- **Remoção de `unitId` de Objective/Goal** (opção A): toca queries e o front de `/processos`
  que passam `unitId` em goals. Mapear todos os usos antes (há `unitId` em vários hooks).
- **Recálculo de progresso agregado**: evitar N+1 — agregar `PlanUnit.progressPct` em vez de
  recalcular a árvore inteira a cada leitura (o cache no `PlanUnit` resolve).
- **Ordem com o plano 23**: fazer **depois** do tenant — `StrategicPlan` precisa de `tenantId`.

---

## Validação

- `npx prisma migrate dev --name plan_multi_unit` + `npx prisma generate`.
- `npx tsc --noEmit` backend + frontend.
- Teste: criar plano em 2 unidades → cada uma vê o plano em `/processos` com execução própria;
  concluir uma fase na UPA não mexe no progresso do HRGM; excluir da UPA mantém o HRGM;
  excluir geral remove de ambas.
- Teste de isolamento (com plano 23): tenant B não vê o plano do tenant A.
