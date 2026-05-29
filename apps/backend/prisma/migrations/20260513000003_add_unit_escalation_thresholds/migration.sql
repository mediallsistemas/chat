-- Add configurable escalation day thresholds per unit
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "escalation_days_level1" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "escalation_days_level2" INTEGER NOT NULL DEFAULT 5;
