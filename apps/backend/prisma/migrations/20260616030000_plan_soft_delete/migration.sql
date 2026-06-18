-- Plano 24.2 — soft-delete de StrategicPlan ("excluir plano (geral)").
-- Aditivo (coluna nullable). Queries de plano passam a filtrar deleted_at IS NULL.
ALTER TABLE "strat_plans" ADD COLUMN "deleted_at" TIMESTAMP(3);
