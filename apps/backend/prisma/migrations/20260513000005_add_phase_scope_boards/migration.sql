-- PhaseScopeBoard: per-unit Kanban boards for phases with unitScope = ALL
CREATE TABLE "phase_scope_boards" (
    "id" TEXT NOT NULL,
    "phase_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "kanban_board_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phase_scope_boards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "phase_scope_boards_phase_id_unit_id_key" ON "phase_scope_boards"("phase_id", "unit_id");

ALTER TABLE "phase_scope_boards" ADD CONSTRAINT "phase_scope_boards_phase_id_fkey"
    FOREIGN KEY ("phase_id") REFERENCES "plan_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "phase_scope_boards" ADD CONSTRAINT "phase_scope_boards_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "phase_scope_boards" ADD CONSTRAINT "phase_scope_boards_kanban_board_id_fkey"
    FOREIGN KEY ("kanban_board_id") REFERENCES "kanban_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
