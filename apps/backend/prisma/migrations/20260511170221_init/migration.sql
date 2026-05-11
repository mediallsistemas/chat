-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('DATA_PROCESSING', 'PUSH_NOTIFICATIONS', 'EMAIL_COMMUNICATIONS', 'ANALYTICS');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "expires_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_consents_user_id_idx" ON "user_consents"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_consents_user_id_type_version_key" ON "user_consents"("user_id", "type", "version");

-- CreateIndex
CREATE INDEX "audit_logs_unit_id_created_at_idx" ON "audit_logs"("unit_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "documents_unit_id_created_at_idx" ON "documents"("unit_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_group_id_created_at_idx" ON "messages"("group_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_group_id_is_pinned_idx" ON "messages"("group_id", "is_pinned");

-- CreateIndex
CREATE INDEX "notifications_unit_id_created_at_idx" ON "notifications"("unit_id", "created_at");

-- CreateIndex
CREATE INDEX "task_impediments_unit_id_status_idx" ON "task_impediments"("unit_id", "status");

-- CreateIndex
CREATE INDEX "task_impediments_unit_id_created_at_idx" ON "task_impediments"("unit_id", "created_at");

-- CreateIndex
CREATE INDEX "task_impediments_escalation_level_idx" ON "task_impediments"("escalation_level");

-- CreateIndex
CREATE INDEX "tasks_column_id_position_idx" ON "tasks"("column_id", "position");

-- CreateIndex
CREATE INDEX "tasks_responsible_user_id_completed_at_idx" ON "tasks"("responsible_user_id", "completed_at");

-- CreateIndex
CREATE INDEX "tickets_unit_id_priority_idx" ON "tickets"("unit_id", "priority");

-- CreateIndex
CREATE INDEX "tickets_unit_id_created_at_idx" ON "tickets"("unit_id", "created_at");

-- CreateIndex
CREATE INDEX "tickets_assigned_to_status_idx" ON "tickets"("assigned_to", "status");

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
