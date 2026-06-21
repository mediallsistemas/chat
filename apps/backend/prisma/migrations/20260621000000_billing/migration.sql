-- Plano 26 — Billing & assinaturas (SaaS).
-- Aditivo: nova coluna users.is_platform_admin (default false) + tabelas
-- billing_subscriptions / billing_events. NÃO toca em tabelas existentes além
-- da coluna nova. Sem RLS nas tabelas de billing: são PLATFORM-scoped (geridas
-- pelo contexto platform, fora do auto-escopo de tenant).

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- AlterTable: platform admin flag (dono do SaaS)
ALTER TABLE "users" ADD COLUMN "is_platform_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: assinatura por tenant (1:1)
CREATE TABLE "billing_subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "provider_customer_id" TEXT,
    "provider_sub_id" TEXT,
    "tier" "PlanTier" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscriptions_tenant_id_key" ON "billing_subscriptions"("tenant_id");

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: trilha de webhooks (idempotência + auditoria)
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "provider_event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_provider_event_id_key" ON "billing_events"("provider_event_id");
CREATE INDEX "billing_events_tenant_id_idx" ON "billing_events"("tenant_id");

-- Backfill: cada tenant existente ganha uma assinatura espelhando seu tier/status atual.
-- Tenant.status TRIAL→TRIALING; ACTIVE→ACTIVE; PAST_DUE→PAST_DUE; SUSPENDED/CANCELED→CANCELED.
INSERT INTO "billing_subscriptions" ("id", "tenant_id", "provider", "tier", "status", "current_period_end", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  t."id",
  'stripe',
  t."plan_tier",
  CASE t."status"
    WHEN 'TRIAL' THEN 'TRIALING'::"SubscriptionStatus"
    WHEN 'ACTIVE' THEN 'ACTIVE'::"SubscriptionStatus"
    WHEN 'PAST_DUE' THEN 'PAST_DUE'::"SubscriptionStatus"
    ELSE 'CANCELED'::"SubscriptionStatus"
  END,
  t."trial_ends_at",
  now(),
  now()
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "billing_subscriptions" s WHERE s."tenant_id" = t."id"
);
