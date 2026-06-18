-- Plano 24.1 — PlanUnit (atribuição N:N plano↔unidade) + backfill dos planos existentes.
-- Aditivo: NÃO toca em StrategicPlan.unit_id (mantido como unidade de origem por ora).
-- Backfill embutido (INSERT) → sem necessidade de prisma generate / parar o backend.

-- CreateTable
CREATE TABLE "strat_plan_units" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "plan_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "progress_pct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "traffic_light" "TrafficLight" NOT NULL DEFAULT 'GREEN',
    "attached_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attached_by" TEXT NOT NULL,

    CONSTRAINT "strat_plan_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "strat_plan_units_plan_id_unit_id_key" ON "strat_plan_units"("plan_id", "unit_id");
CREATE INDEX "strat_plan_units_tenant_id_idx" ON "strat_plan_units"("tenant_id");
CREATE INDEX "strat_plan_units_unit_id_idx" ON "strat_plan_units"("unit_id");

-- AddForeignKey
ALTER TABLE "strat_plan_units" ADD CONSTRAINT "strat_plan_units_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "strat_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "strat_plan_units" ADD CONSTRAINT "strat_plan_units_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: cada plano existente vira 1 PlanUnit na sua unidade de origem (preserva o status do plano).
INSERT INTO "strat_plan_units" ("id", "tenant_id", "plan_id", "unit_id", "status", "progress_pct", "traffic_light", "attached_at", "attached_by")
SELECT gen_random_uuid()::text, p."tenant_id", p."id", p."unit_id", p."status", 0, 'GREEN', now(), p."created_by"
FROM "strat_plans" p
WHERE NOT EXISTS (
  SELECT 1 FROM "strat_plan_units" pu WHERE pu."plan_id" = p."id" AND pu."unit_id" = p."unit_id"
);
