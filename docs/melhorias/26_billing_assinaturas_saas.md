# 26 — Billing & assinaturas: vender acesso mensal

> **⚠️ Antes de implementar este plano:** leia e siga **obrigatoriamente** as regras em
> [`.claude/rules/`](../../.claude/rules/) — em especial `architecture.md`, `security.md` e
> `ui.md`. Regras marcadas **🔴 OBRIGATÓRIO** são bloqueantes. Toda query respeita o isolamento
> por **tenant** e por **unit**. Se o código divergir da regra, **o código manda** — atualize a
> regra (ver `.claude/rules/README.md`).

**Prioridade:** 🟡 Alta — é o que transforma o produto em receita recorrente
**Tempo estimado:** ~24–32h
**Área:** Backend (contexto `platform` + billing), Frontend (telas de plataforma + estado de conta), Infra (Stripe, webhooks)
**Pré-requisito:** [23](23_multitenancy_saas.md) (multitenant) — billing é **por tenant**.

> Este plano fecha o ciclo comercial: planos de assinatura (tiers), cobrança recorrente,
> trial, suspensão por inadimplência e o painel do **dono do SaaS** (platform admin) para
> gerenciar clientes. Escopo: **não** reinventa pagamento — integra um provedor (Stripe).

---

## Ideia central

Cada **Tenant** (cliente) tem uma **assinatura** com um **tier**. O acesso ao produto é
condicionado ao `Tenant.status` (criado no plano 23). Quem paga em dia → `ACTIVE`. Quem atrasa →
`PAST_DUE` → `SUSPENDED` (acesso bloqueado/somente-leitura). Um provedor de pagamento (Stripe)
cuida de cartão, recorrência e faturas; o nosso backend reage aos **webhooks** e ajusta o status.

```
Stripe (cobrança recorrente, faturas, cartão)
   │  webhooks (invoice.paid, invoice.payment_failed, subscription.deleted)
   ▼
Backend (contexto platform/billing) → atualiza Tenant.status / planTier / limites
   ▼
TenantGuard / BillingGuard → libera ou bloqueia o acesso conforme o status
```

---

## Tiers de assinatura (`PlanTier` — enum do plano 23)

Proposta inicial (ajustável comercialmente):

| Tier | Preço/mês (ex.) | maxUnits | maxUsers | Recursos |
|------|-----------------|----------|----------|----------|
| **STARTER** | R$ — | 3 | 25 | Planos, Kanban, Chat, Impedimentos |
| **PRO** | R$ — | 10 | 100 | + Reuniões/vídeo, Relatórios PDF/Excel, Painel Jarvis completo |
| **ENTERPRISE** | sob consulta | ∞ | ∞ | + DB dedicado (isolamento físico, plano 23 híbrido), SSO, SLA |

> Os limites (`maxUnits`/`maxUsers`) já estão no `Tenant` (plano 23). Este plano os **aplica**:
> bloquear criação de unidade/usuário acima do limite do tier, com mensagem clara de upgrade.

---

## Modelo de dados (contexto `platform`)

```prisma
model Subscription {
  id                   String             @id @default(uuid())
  tenantId             String             @unique @map("tenant_id")
  provider             String             @default("stripe")
  providerCustomerId   String?            @map("provider_customer_id")     // cus_...
  providerSubId        String?            @map("provider_sub_id")          // sub_...
  tier                 PlanTier
  status               SubscriptionStatus @default(TRIALING)               // TRIALING|ACTIVE|PAST_DUE|CANCELED
  currentPeriodEnd     DateTime?          @map("current_period_end")
  cancelAtPeriodEnd    Boolean            @default(false) @map("cancel_at_period_end")
  createdAt            DateTime           @default(now()) @map("created_at")
  updatedAt            DateTime           @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])
  @@map("billing_subscriptions")
}

model BillingEvent {                       // trilha de webhooks (idempotência + auditoria)
  id              String   @id @default(uuid())
  tenantId        String?  @map("tenant_id")
  provider        String   @default("stripe")
  providerEventId String   @unique @map("provider_event_id")   // evita reprocessar webhook
  type            String                                       // invoice.paid, ...
  payload         Json
  processedAt     DateTime @default(now()) @map("processed_at")
  @@map("billing_events")
}
```

> `Subscription` é **platform-scoped** (uma por tenant), **não** passa pela Prisma Extension de
> tenant — é gerida pelo contexto `platform`. `BillingEvent.providerEventId @unique` garante
> idempotência (Stripe reenvia webhooks).

---

## Fluxos

### Onboarding / signup de tenant
1. Cliente assina no site → cria `Tenant` (`status: TRIAL`, `trialEndsAt = +14d`) + 1 unidade
   default + usuário admin (provisionamento do plano 23.6).
2. Cria `Subscription` (`TRIALING`) e o customer no Stripe.
3. Redireciona para `acme.app.com` já logado.

### Cobrança recorrente (webhooks Stripe)
- `invoice.paid` → `Subscription.status = ACTIVE`, `Tenant.status = ACTIVE`, atualiza `currentPeriodEnd`.
- `invoice.payment_failed` → `PAST_DUE` (acesso ainda liberado, banner de aviso + e-mail).
- após N tentativas / `subscription.deleted` → `SUSPENDED`/`CANCELED` (acesso bloqueado).
- Endpoint `POST /platform/billing/webhook` — **assinatura do Stripe verificada** (raw body),
  registra `BillingEvent` antes de processar (idempotência).

### Suspensão por inadimplência
- `BillingGuard` (após `TenantGuard`): se `Tenant.status` ∈ {`SUSPENDED`,`CANCELED`} → bloqueia
  mutações (403 com mensagem "Assinatura suspensa — regularize o pagamento"), permitindo só
  leitura + a tela de billing. Decisão de produto: **somente-leitura** vs **bloqueio total**
  (recomendo somente-leitura por 7 dias, depois bloqueio).

### Upgrade/downgrade de tier
- Tela de billing do tenant → muda tier no Stripe → webhook atualiza `tier` + `maxUnits/maxUsers`.
- Downgrade que viola limites (ex.: tem 8 unidades, cai para STARTER/3): bloquear até o cliente
  ajustar, com mensagem clara.

---

## Guard stack final

```
JwtAuthGuard → TenantGuard → BillingGuard → RolesGuard → UnitScopeGuard
```

`BillingGuard` é global; rotas isentas (login, billing, webhook, leitura básica) marcadas com um
decorator `@AllowSuspended()` (espelha o `@Public()` existente).

---

## Painel do dono do SaaS (platform admin)

Contexto `contexts/platform/` (criado no plano 23.6), com `PlatformAdminGuard` (opera sobre todos
os tenants, **fora** da extension de tenant). Telas:
- **Lista de tenants:** nome, slug, tier, status, nº unidades/usuários, MRR, próximo vencimento.
- **Detalhe do tenant:** suspender/reativar manualmente, mudar tier, ver faturas, impersonar
  (login como admin do tenant para suporte — **auditado**).
- **Métricas do negócio:** MRR, churn, trials ativos, conversão trial→pago.

> Frontend: grupo de rotas `(platform)` separado de `(auth)`/`(admin)`, acessível só em um host
> de plataforma (ex.: `admin.app.com`) por platform admins. Nunca exposto a tenants.

---

## Infra AWS (resumo — detalhe no índice [23_26](23_26_INDICE_SAAS.md))

- **Stripe** em modo subscription; chaves em env (`REQUIRED_ENV_VARS`, nunca no código —
  `security.md` §2). Webhook secret idem.
- **Route53 wildcard** `*.app.com` + **ACM wildcard cert** → subdomínio por tenant (plano 23.4).
- **RDS/Aurora Postgres** único (DB compartilhado + RLS); tenant enterprise pode migrar para
  instância dedicada (tier ENTERPRISE).
- **CloudFront + S3** (ou MinIO) para arquivos; chave prefixada por tenant (plano 23).

---

## Faseamento

| Fase | Entrega | Esforço |
|---|---|---|
| 26.1 | Models `Subscription`/`BillingEvent` + enums + migration | ~4h |
| 26.2 | Integração Stripe: customer/subscription/checkout no signup + trial | ~8h |
| 26.3 | Webhook `/platform/billing/webhook` (verificação + idempotência) → status do tenant | ~6h |
| 26.4 | `BillingGuard` + aplicação dos limites de tier (maxUnits/maxUsers) | ~5h |
| 26.5 | Painel platform admin (lista/detalhe de tenants, suspender, impersonar auditado) | ~8h |
| 26.6 | Tela de billing do tenant (tier atual, faturas, upgrade, banner de inadimplência) | ~5h |

---

## Regras `.claude` que este plano respeita

- **security.md §2** — chaves Stripe/webhook em `REQUIRED_ENV_VARS`, sem fallback no código.
- **security.md §4** — `PlatformAdminGuard` e RBAC; impersonação **auditada** (`audit_log`).
- **security.md §6** — eventos de billing e impersonação em `audit_log` com `tenantId`.
- **architecture.md §5** — webhook lê raw body (exceção controlada ao envelope), demais rotas no padrão.
- **architecture.md §3** — mudança de status do tenant publica evento (ex.: `tenant.suspended`)
  para efeitos (e-mail, realtime), não chama contextos direto.

---

## Riscos e cuidados

- **Webhook é a fonte da verdade do status** — nunca confiar no retorno do checkout do client.
  Sempre reconciliar pelo webhook (idempotente via `providerEventId`).
- **Raw body do webhook** quebra se o `body-parser`/envelope global interferir — configurar rota
  crua só para o webhook.
- **Impersonação** é poderosa: exigir platform admin, registrar em audit, e banner visível "você
  está impersonando o tenant X".
- **Downgrade destrutivo:** nunca apagar dados ao baixar de tier — bloquear criação, manter o que existe.
- **Trial sem cartão vs com cartão:** decisão de produto (recomendo trial sem cartão, 14 dias).

---

## Validação

- `npx prisma migrate dev --name billing` + `npx prisma generate`.
- Stripe em test mode: assinar → `ACTIVE`; simular `payment_failed` → banner; simular cancel →
  `SUSPENDED` bloqueia mutação mas permite leitura/billing.
- Idempotência: reenviar o mesmo webhook não duplica efeito.
- Limites: criar unidade acima do `maxUnits` → bloqueado com mensagem de upgrade.
