-- Fix kanban_boards.owner_id for MACRO_TASK boards.
-- Previously the service wrote phase_id into owner_id, so all macro tasks of a
-- given phase pointed their boards to the same owner_id. Re-point each board
-- to the macro_task that already references it via kanban_board_id.
UPDATE "kanban_boards" AS b
SET "owner_id" = m."id"
FROM "macro_tasks" AS m
WHERE m."kanban_board_id" = b."id"
  AND b."owner_type" = 'MACRO_TASK'
  AND b."owner_id" <> m."id";
