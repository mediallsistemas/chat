-- Rename kanban tables to use kb_ prefix convention.
ALTER TABLE "kanban_boards" RENAME TO "kb_boards";
ALTER TABLE "kanban_columns" RENAME TO "kb_columns";
ALTER TABLE "tasks" RENAME TO "kb_tasks";
ALTER TABLE "task_dependencies" RENAME TO "kb_task_dependencies";
ALTER TABLE "task_checklists" RENAME TO "kb_task_checklists";
ALTER TABLE "task_files" RENAME TO "kb_task_files";
