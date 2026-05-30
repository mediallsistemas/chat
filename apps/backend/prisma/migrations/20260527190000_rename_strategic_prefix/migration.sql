-- Rename strategic tables to use strat_ prefix convention.
ALTER TABLE "strategic_plans" RENAME TO "strat_plans";
ALTER TABLE "objectives" RENAME TO "strat_objectives";
ALTER TABLE "goals" RENAME TO "strat_goals";
ALTER TABLE "plan_phases" RENAME TO "strat_plan_phases";
ALTER TABLE "phase_scope_boards" RENAME TO "strat_phase_scope_boards";
ALTER TABLE "macro_tasks" RENAME TO "strat_macro_tasks";
