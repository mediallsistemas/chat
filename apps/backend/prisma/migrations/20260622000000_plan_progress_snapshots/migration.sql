-- Plano 25 (Slice 3) — histórico de progresso dos planos para o painel desenhar
-- a evolução no tempo. Tabela aditiva strat_plan_progress_snapshots; não toca em
-- nenhuma tabela existente. tenant_id nullable (fase de transição multitenant).

-- CreateTable
CREATE TABLE "strat_plan_progress_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "plan_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "progress_pct" INTEGER NOT NULL,
    "traffic_light" "TrafficLight" NOT NULL,
    "captured_on" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strat_plan_progress_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "strat_plan_progress_snapshots_plan_id_captured_on_key" ON "strat_plan_progress_snapshots"("plan_id", "captured_on");
CREATE INDEX "strat_plan_progress_snapshots_tenant_id_idx" ON "strat_plan_progress_snapshots"("tenant_id");
CREATE INDEX "strat_plan_progress_snapshots_captured_on_idx" ON "strat_plan_progress_snapshots"("captured_on");

-- AddForeignKey
ALTER TABLE "strat_plan_progress_snapshots" ADD CONSTRAINT "strat_plan_progress_snapshots_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "strat_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (defense-in-depth, plano 23.5). Mesma policy tenant_isolation
-- das demais tabelas tenant-scoped. Inerte sob superuser; ativa com role dedicada +
-- GUC app.current_tenant_id por transação. Idempotente.
ALTER TABLE "strat_plan_progress_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "strat_plan_progress_snapshots" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "strat_plan_progress_snapshots";
CREATE POLICY tenant_isolation ON "strat_plan_progress_snapshots"
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
