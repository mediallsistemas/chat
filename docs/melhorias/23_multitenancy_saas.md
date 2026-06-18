# 23 — Multitenancy (SaaS): isolar por Tenant para revender acesso

> **⚠️ Antes de implementar este plano:** leia e siga **obrigatoriamente** as regras em
> [`.claude/rules/`](../../.claude/rules/) — em especial `architecture.md`, `security.md` e
> `ui.md`. Regras marcadas **🔴 OBRIGATÓRIO** são bloqueantes. Toda query respeita o isolamento
> por **tenant** e por **unit**. Se o código divergir da regra, **o código manda** — atualize a
> regra (ver `.claude/rules/README.md`).

**Prioridade:** 🔴 Fundacional — bloqueia a venda do produto como SaaS
**Tempo estimado:** ~40–60h (faseável; cada fase entrega um marco testável)
**Área:** Backend (Prisma, guards, auth, Prisma extension), Infra (subdomínio, RLS), Frontend (resolução de tenant)
**Pré-requisito:** nenhum — **este plano vem antes** de [24](24_plano_multiunidade.md), [25](25_painel_jarvis_command_center.md) e [26](26_billing_assinaturas_saas.md).

> **Decisão tomada (isolamento):** **DB compartilhado + coluna `tenant_id` em tudo + Row-Level
> Security (RLS) do Postgres**, com uma **Prisma Client Extension** que injeta o `tenant_id`
> automaticamente. Razão: menor custo na AWS (1 RDS), segurança forte (o banco barra no nível da
> linha mesmo se o código esquecer o filtro), migrações simples. Deixa aberta a evolução para
> **DB dedicado por tenant** (tier enterprise) sem reescrever o app.

---

## Ideia central

Hoje o sistema é **single-tenant**: todo o banco é "Mediall Brasil". Existe `Unit` (UPA, hospital…)
com hierarquia (`parentId`), mas **não existe o conceito de cliente/organização acima da unidade**.
Para vender acesso mensal, precisamos de uma camada nova no topo:

```
ANTES                          DEPOIS
Unit (UPA, hospital...)        Tenant (cliente = holding/empresa que assina)
  └─ dados (unit_id)             └─ Unit (UPA, hospital...)
                                      └─ dados (tenant_id + unit_id)
```

`Tenant` = o cliente que paga a assinatura. Cada tenant é uma **holding isolada**, com suas
próprias unidades, usuários, planos, tarefas, chat — **sem nunca enxergar dados de outro tenant**.

A boa notícia: o codebase **já tem a disciplina certa** — toda query de unidade já filtra por
`unitId` (`security.md` §5), o acesso a dados é centralizado no `PrismaService`, o schema é
multi-file, e o guard stack é unificado. Adicionar o tenant é **estender esse mesmo padrão um
nível acima**, não reinventá-lo.

---

## A regra nova (irmã da regra nº1)

> **Toda query filtra por `tenantId` ANTES de `unitId`.** O `tenantId` **nunca** vem do body nem
> de parâmetro manipulável pelo cliente — vem do **contexto da requisição** (derivado do JWT +
> subdomínio, validado no guard). Um vazamento entre tenants é um incidente de dados gravíssimo
> (cliente A vê dados do cliente B).

Diferença importante de mecanismo em relação ao `unitId`:
- `unitId` continua vindo do **path param** (`units/:unitId/...`) — é escolha do usuário dentro do
  seu tenant.
- `tenantId` vem do **contexto** (não da URL editável) — é a fronteira de segurança que o usuário
  **não pode** atravessar.

---

## Arquitetura da solução (4 camadas de defesa)

```
1. Resolução de tenant   → subdomínio (acme.app.com) + claim tenantId no JWT
2. Contexto de request   → AsyncLocalStorage guarda { tenantId } por request
3. Prisma Extension      → injeta where { tenantId } em toda leitura e data.tenantId em toda escrita
4. Postgres RLS          → o banco recusa linhas de outro tenant (rede de segurança final)
```

Camadas 1–3 são **aplicação** (rápidas, cobrem 100% das queries). Camada 4 é **banco**
(impõe mesmo se o app falhar). Juntas: o erro humano deixa de ser um vazamento.

---

## Modelo de dados

### 1. Novo model `Tenant` (`prisma/schema/_tenant.prisma` — novo arquivo de domínio)

```prisma
model Tenant {
  id            String       @id @default(uuid())
  name          String                                    // "Holding Acme Saúde"
  slug          String       @unique                      // "acme" → acme.app.com
  status        TenantStatus @default(TRIAL)              // TRIAL | ACTIVE | PAST_DUE | SUSPENDED | CANCELED
  planTier      PlanTier     @default(STARTER) @map("plan_tier")  // ver plano 26
  maxUnits      Int          @default(3)  @map("max_units")       // limite por tier
  maxUsers      Int          @default(25) @map("max_users")
  trialEndsAt   DateTime?    @map("trial_ends_at")
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")
  deletedAt     DateTime?    @map("deleted_at")           // soft-delete

  units Unit[]
  users User[]

  @@map("tenants")
}
```

> `TenantStatus` e `PlanTier` são enums novos em `_enums.prisma`. `status` é o que o plano de
> billing (26) usa para suspender acesso por inadimplência.

### 2. `tenantId` em **todo** model com dados de cliente

Adicionar `tenantId String @map("tenant_id")` + relação + `@@index([tenantId])` em **todos** os
models de dados. Começar pelos âncora (`Unit`, `User`) e descer para os de domínio:

```prisma
model Unit {
  // ...campos atuais...
  tenantId String @map("tenant_id")
  tenant   Tenant @relation(fields: [tenantId], references: [id])
  @@index([tenantId])
  @@map("units")
}
```

**Por que denormalizar `tenantId` em todas as tabelas (e não só em `Unit`)?** Mesma razão pela
qual o codebase já denormaliza `unitId` em `Task`/`KanbanBoard` em vez de subir pela relação:
(a) o filtro fica num índice composto `(tenant_id, unit_id, ...)` — caminho rápido; (b) a RLS do
Postgres precisa da coluna na própria tabela; (c) a Prisma Extension injeta um `where` simples.

Models que recebem `tenantId` (verificar cada arquivo do schema):
`Unit`, `User`, `UserUnit`, `StrategicPlan`, `Objective`, `Goal`, `PlanPhase`, `MacroTask`,
`PhaseScopeBoard`, `KanbanBoard`, `KanbanColumn`, `Task`, `TaskDependency`, `TaskChecklist`,
`TaskFile`, `TaskImpediment`, `Group`, `Message`, `MessageReaction`, `MessageBookmark`,
`Meeting`, `MeetingParticipant`, `MeetingChatMessage`, `Document`, `DocumentFolder`, `Ticket`,
`TicketComment`, `Notification`, `NotificationSetting`, `PushSubscription`, `AuditLog`,
`UserConsent`.

> **Exceções (sem `tenantId`):** tabelas globais da plataforma (ex.: futura `PlatformAdmin`,
> `Tenant` em si). Decidir caso a caso.

### 3. Índices: prefixar com `tenantId`

Os índices compostos existentes em `Task` (`@@index([unitId, dueDate])` etc.) ganham `tenantId`
na frente: `@@index([tenantId, unitId, dueDate])`. O caminho de leitura mais comum passa a ser
"este tenant → esta unidade → este filtro", e o índice cobre exatamente isso.

---

## Resolução de tenant + contexto de request

### Subdomínio (recomendado) + claim no JWT

- Cada tenant tem um `slug` → **subdomínio** `acme.app.com`. O Nginx/Next repassa o host.
- No **login**, o backend resolve o tenant pelo subdomínio, valida que o usuário pertence a ele,
  e emite o JWT com `tenantId` embutido.
- `JwtPayload` (em `@mediall/types`) ganha `tenantId`:

```ts
// packages/types — JwtPayload
export interface JwtPayload {
  sub: string
  email: string
  role: UserRole
  accessScope: AccessScope
  tenantId: string          // ← novo
  units: string[]
}
```

### AsyncLocalStorage (contexto por request)

Usar **`nestjs-cls`** (wrapper limpo de AsyncLocalStorage para Nest) para guardar `{ tenantId }`
por request. Setado cedo, lido pela Prisma Extension sem precisar passar `tenantId` manualmente.

```ts
// infrastructure/tenant/tenant-context.ts
export const tenantStorage = new AsyncLocalStorage<{ tenantId: string }>()
export const currentTenantId = () => tenantStorage.getStore()?.tenantId
```

---

## Guard stack: adicionar `TenantGuard`

Ordem nova (global), o tenant é validado **antes** de tudo que depende de escopo:

```
JwtAuthGuard → TenantGuard → RolesGuard → UnitScopeGuard
```

```ts
// shared/guards/tenant.guard.ts (novo)
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest()
    const user: JwtPayload = req.user
    if (!user) return false

    // 1. tenant do JWT precisa bater com o tenant do subdomínio (anti-token-replay cross-tenant)
    const hostTenant = req.tenantFromHost            // setado por um middleware de subdomínio
    if (hostTenant && hostTenant !== user.tenantId) return false

    // 2. publica o tenantId no AsyncLocalStorage para a Prisma Extension consumir
    tenantStorage.enterWith({ tenantId: user.tenantId })
    return true
  }
}
```

> `BaseUnitController` continua igual — o `TenantGuard` entra na composição global (em
> `app.module.ts` como `APP_GUARD`), então todo controller herda. Mantém o padrão de
> `architecture.md` §2 (herda guards, não redeclara).

---

## Prisma Extension: auto-escopo por tenant

`PrismaService` passa a aplicar uma **Client Extension** (Prisma 5+, substitui o `$use`
deprecado) que injeta o `tenantId` do contexto em toda operação dos models tenant-scoped:

```ts
// prisma/prisma.service.ts (estender o client existente)
const tenantScoped = new Set(['Unit','User','Task','StrategicPlan', /* ...todos... */])

this.client = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const tid = currentTenantId()
        if (!tid || !tenantScoped.has(model)) return query(args)

        // leitura: injeta where tenantId
        if (['findMany','findFirst','findUnique','count','aggregate','updateMany','deleteMany'].includes(operation)) {
          args.where = { ...args.where, tenantId: tid }
        }
        // escrita: injeta data.tenantId
        if (['create'].includes(operation)) {
          args.data = { ...args.data, tenantId: tid }
        }
        if (['createMany'].includes(operation)) {
          args.data = (Array.isArray(args.data) ? args.data : [args.data]).map((d) => ({ ...d, tenantId: tid }))
        }
        return query(args)
      },
    },
  },
})
```

> **Continua valendo o filtro manual de `unitId`** (`security.md` §5). A extension cuida do
> `tenantId`; o `unitId` permanece responsabilidade do service (a extension **não** substitui a
> regra nº1). São escopos diferentes: tenant = fronteira de segurança automática; unit = escolha
> do usuário no path.
> **Cuidado com `findUnique` por PK:** `findUnique` não aceita `where` arbitrário — para esses
> casos, ou trocar por `findFirst({ where: { id, tenantId } })`, ou validar o `tenantId` do
> resultado após a busca. Mapear no review.

---

## Postgres RLS (rede de segurança final)

Após o app já injetar `tenantId`, adicionar RLS como **defesa do banco** (fase 23.5, opcional mas
recomendada para saúde):

```sql
ALTER TABLE kb_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON kb_tasks
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

O app passa a setar a variável de sessão por transação:
```ts
await prisma.$executeRaw`SET LOCAL app.current_tenant_id = ${tid}`
```

> **Trade-off honesto:** com pool de conexões, o `SET LOCAL` precisa rodar **dentro da mesma
> transação** das queries — custo de envolver requests em transação. Por isso a recomendação é:
> **Prisma Extension como imposição primária (fase 23.3)** + **RLS nas tabelas mais sensíveis
> primeiro** (saúde/PII: `users`, `documents`, `kb_tasks`, `messages`) na fase 23.5, expandindo
> depois. Não bloqueia o go-live de SaaS, mas é o que dá o argumento de compliance forte.

---

## Migração dos dados existentes (single-tenant → 1 tenant)

Script de migração de dados (não só schema):
1. Criar a migration que adiciona `tenants` + colunas `tenant_id` **nullable**.
2. Script de backfill: `INSERT` de 1 tenant "Mediall Brasil" → `UPDATE` todas as tabelas
   `SET tenant_id = <esse id>`.
3. Segunda migration: tornar `tenant_id` **NOT NULL** + FKs + índices.

```bash
npx prisma migrate dev --name add_tenant_nullable
node prisma/backfill-tenant.ts           # cria o tenant Mediall e preenche tenant_id
npx prisma migrate dev --name tenant_not_null_and_indexes
```

> Padrão de migração em 3 passos (nullable → backfill → not null) evita downtime e é o jeito
> seguro de adicionar coluna obrigatória em tabela com dados.

---

## Realtime, arquivos e infra

- **Socket.IO:** rooms passam a ser **tenant-scoped**: `tenant:<tid>:unit:<unitId>`,
  `tenant:<tid>:group:<groupId>`. O `handleConnection` (já valida JWT) passa a validar `tenantId`
  e só entra em rooms do próprio tenant (`security.md` §11). O Redis adapter continua igual.
- **MinIO/arquivos:** a chave do objeto ganha o prefixo de tenant:
  `${tenantId}/${unitId}/${randomUUID()}.${ext}` (hoje é `${unitId}/...`, `security.md` §7).
  Preserva isolamento físico no storage também.
- **Auditoria:** `AuditLogInterceptor` passa a gravar `tenantId` junto de `userId`/`unitId`.
- **Config:** nada de secret por tenant no código. Subdomínio→tenant é dado, não secret.

---

## Platform admin (o dono do SaaS)

Há **dois níveis de "admin"** agora:
- **Tenant admin** (`UserRole.SUPER_ADMIN` dentro de um tenant) — administra a holding dele.
- **Platform admin** (você, o vendedor) — cria/suspende tenants, vê billing, métricas globais.

Recomendação: contexto novo `contexts/platform/` com guard próprio (`PlatformAdminGuard`),
**fora** do escopo de tenant (não passa pela extension de tenant — opera sobre todos). Rotas
tipo `/platform/tenants`, `/platform/tenants/:id/suspend`. Telas de gestão de tenants ficam no
plano de billing (26).

---

## Faseamento (cada fase é um marco testável)

| Fase | Entrega | Esforço |
|---|---|---|
| 23.1 | Model `Tenant` + enums + colunas `tenant_id` nullable + **backfill** (1 tenant Mediall) + not-null | ~10h |
| 23.2 | `JwtPayload.tenantId` + `nestjs-cls` + `TenantGuard` no stack global + login resolve tenant | ~8h |
| 23.3 | **Prisma Extension** auto-escopo + auditar `findUnique` por PK (regra nº1 do tenant) | ~10h |
| 23.4 | Subdomínio: middleware de host, Next resolve slug, Nginx/Route53 wildcard | ~6h |
| 23.5 | RLS nas tabelas sensíveis (users, documents, kb_tasks, messages) | ~8h |
| 23.6 | Realtime/arquivos/auditoria tenant-scoped + contexto `platform` + provisionamento de tenant | ~10h |

> Billing/assinatura (Stripe, suspensão, tiers) é o plano **[26](26_billing_assinaturas_saas.md)**.
> Faz sentido logo após 23.6.

---

## Regras `.claude` que este plano respeita / atualiza

- **security.md §5** — a regra nº1 ganha uma irmã: filtro por `tenantId` (automático via extension)
  **antes** de `unitId` (manual). Atualizar `security.md` com a seção de tenant ao concluir.
- **architecture.md §4** — acesso só pelo `PrismaService` (agora estendido); schema multi-file
  ganha `_tenant.prisma`.
- **architecture.md §2** — `TenantGuard` entra como guard global; controllers continuam herdando.
- **architecture.md §9** — novas vars (se houver) entram em `REQUIRED_ENV_VARS`.
- **security.md §11** — socket valida `tenantId` no handshake; rooms tenant-scoped.
- **security.md §7** — chave de arquivo prefixada por tenant.
- **architecture.md §10** — `JwtPayload`, `TenantStatus`, `PlanTier` em `@mediall/types`.

---

## Riscos e cuidados

- **`findUnique` por PK fura a extension** (não tem `where` flexível). É o ponto nº1 do review:
  trocar por `findFirst({ where: { id, tenantId } })` ou validar o resultado. **Bloqueante.**
- **Queries cross-tenant legítimas do platform admin** precisam **pular** a extension — usar um
  client sem o contexto de tenant (ou um flag explícito). Não vazar isso para rotas normais.
- **Backfill em produção** (quando houver): rodar nullable→backfill→not-null, nunca not-null de
  cara em tabela cheia.
- **RLS + pool de conexões**: `SET LOCAL` só vale na transação — medir custo antes de expandir.
- **Subdomínio em dev**: `*.localhost` ou `/etc/hosts`; documentar no `.env.example`.
- **Seed**: `seed-strategic.ts` e demais seeds precisam setar `tenantId`.

---

## Validação

- `npx prisma migrate dev` (3 migrations em ordem) + `npx prisma generate`.
- `npx tsc --noEmit` backend + frontend limpos.
- Teste de isolamento (e2e, **obrigatório**): logar como tenant A, tentar ler recurso de tenant B
  por ID direto → **404/empty**, nunca dado. Repetir para Task, Document, Message, Plan.
- Teste de RLS: com `app.current_tenant_id` de A, `SELECT` cru em tabela de B → 0 linhas.
- Smoke: criar 2º tenant, logar nos dois subdomínios, confirmar dados completamente separados.

---

## Status de implementação (2026-06-16)

| Sub-fase | Estado |
|---|---|
| 23.1 Tenant + `tenant_id` (36 models, nullable) + backfill | ✅ migration aplicada; 2476 linhas |
| 23.2 `JwtPayload.tenantId` + `TenantGuard` + contexto ALS (AsyncLocalStorage nativo) | ✅ |
| 23.3 Auto-escopo — **middleware `$use`** (não client extension); `findUnique` pós-filtrado; transição-safe (tenant **OU** null) | ✅ build + smoke E2E |
| 23.4 `tenantSlug` no JWT + **host check** no `TenantGuard` (dev-lenient) | ✅ (Route53/Nginx wildcard = deploy) |
| 23.5 **RLS habilitada no DB** — `ENABLE`+`FORCE`+policy `tenant_isolation` nas 36 tabelas (migration `20260616010000_enable_rls`) | ✅ aplicada, **inerte sob superuser** |
| seed gap | ✅ `ensureTenantAndBackfill` (seed + `db:backfill-tenant`) |
| 23.5 ativação da RLS (role + GUC) · `tenant_id` NOT NULL · 23.6 (socket/arquivos/platform) | ⏳ pendente |

> **Decisões reais (divergiram do rascunho acima):** auto-escopo via **`$use`** (não `$extends`),
> **AsyncLocalStorage nativo** (não `nestjs-cls`), `tenant_id` é **coluna escalar sem `@relation`**
> (igual ao `unitId` em `Task`). O texto acima das seções "Prisma Extension"/"nestjs-cls" é o
> rascunho original — o código vigente manda (ver `.claude/rules/architecture.md` §0).

---

## Runbook — ATIVAR a RLS em produção

A RLS está **habilitada no banco** mas **não enforça** enquanto o app conecta como **superuser**
(`postgres`) — superusuários ignoram RLS, mesmo com `FORCE`. Confirmado em dev. Para ativar:

1. **Criar uma role dedicada não-superusuário** (e sem `BYPASSRLS`):
   ```sql
   CREATE ROLE mediall_app LOGIN PASSWORD '<secret>' NOSUPERUSER NOBYPASSRLS;
   GRANT CONNECT ON DATABASE mediall_db TO mediall_app;
   GRANT USAGE ON SCHEMA public TO mediall_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mediall_app;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mediall_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mediall_app;
   ```
   > A role **não pode** ser dona das tabelas nem ter `BYPASSRLS` (senão ignora RLS). `FORCE` já
   > cobre o caso de dono, mas o mais seguro é uma role separada. Migrations continuam rodando com
   > a role administradora (dona); o **app runtime** usa `mediall_app`.

2. **Apontar o app para a nova role** (`DATABASE_URL` com `mediall_app`). Migrations (`migrate
   deploy`) seguem com a role admin — separe as duas connection strings.

3. **Setar o GUC `app.current_tenant_id` por request** (pré-requisito — sem isto, `mediall_app`
   vê **0 linhas**, fail-closed). Padrão com pool de conexões: envolver as queries do request numa
   **transação interativa** que primeiro chama
   `SELECT set_config('app.current_tenant_id', $tenantId, true)` (`true` = escopo da transação).
   Opções de wiring: (a) client Prisma request-scoped via `$transaction(async (tx) => …)` exposto
   pelo `TenantGuard`/interceptor; (b) extensão que envolve cada operação. **Custo:** cada request
   vira transação — medir. ⚠️ Hoje o auto-escopo usa `$use` (queries soltas, sem transação); o GUC
   exige essa mudança — é a parte que falta para a RLS sair do "inerte".

4. **Validar:** conectado como `mediall_app`, `SET app.current_tenant_id` = tenant A →
   `SELECT * FROM kb_tasks` mostra só A; sem o GUC → 0 linhas; tentar ler tenant B → 0 linhas.

### Antes de `tenant_id NOT NULL` (não fazer ainda)
Hoje há **0 linhas** com `tenant_id` nulo, mas tornar NOT NULL **quebraria** criações **sem
contexto de tenant**: jobs (`@Cron`/BullMQ criam notificações etc. sem request → ALS vazio → o
`$use` não injeta `tenantId`), nested-writes e seeds. Pré-requisitos do NOT NULL:
1. Cobrir todos os caminhos de `create` sem contexto (jobs iteram por tenant ou setam `tenantId`
   explícito; nested-writes; `seed-strategic.ts`).
2. Migration `tenant_id NOT NULL` (em 36 tabelas).
3. **Apertar o escopo** do `$use`: trocar `{ OR: [{tenantId}, {tenantId: null}] }` por
   `{ tenantId }` (remover o ramo de transição) — fazer **antes** de onboardar o 2º tenant.
