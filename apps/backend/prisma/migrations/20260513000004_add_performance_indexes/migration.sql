-- Performance indexes for high-frequency query fields

-- Tasks: unitId-based queries (stale tasks, deadline alerts, dashboard summaries)
CREATE INDEX IF NOT EXISTS "tasks_unit_id_completed_at_idx" ON "tasks"("unit_id", "completed_at");
CREATE INDEX IF NOT EXISTS "tasks_unit_id_due_date_idx" ON "tasks"("unit_id", "due_date");
CREATE INDEX IF NOT EXISTS "tasks_unit_id_updated_at_idx" ON "tasks"("unit_id", "updated_at");

-- Messages: sender-based queries (file panels, user message history)
CREATE INDEX IF NOT EXISTS "messages_sender_id_created_at_idx" ON "messages"("sender_id", "created_at");
