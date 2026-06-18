-- Multitenancy plano 23.1 — additive ONLY.
-- Adds Tenant table + enums + nullable tenant_id column (and its index) to every
-- domain table. Hand-written to EXCLUDE the unrelated pre-existing drift that a
-- schema diff would otherwise include (stale constraint/index renames and, most
-- importantly, dropping "chat_messages_search_vector_idx" — the FTS GIN index that
-- Prisma cannot model). Index/column names match Prisma's conventions so this
-- creates no new drift. Columns are NULLABLE here; a later migration makes them
-- NOT NULL after prisma/backfill-tenant.ts runs.

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "plan_tier" "PlanTier" NOT NULL DEFAULT 'STARTER',
    "max_units" INTEGER NOT NULL DEFAULT 3,
    "max_users" INTEGER NOT NULL DEFAULT 25,
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- AddColumn tenant_id (nullable) to every tenant-scoped table
ALTER TABLE "audit_entries" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "chat_custom_emojis" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "chat_group_members" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "chat_groups" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "chat_huddles" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "chat_message_bookmarks" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "chat_message_reactions" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "chat_reminders" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "consent_user_consents" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "doc_documents" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "doc_folders" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "imp_task_impediments" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "kb_boards" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "kb_columns" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "kb_task_checklists" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "kb_task_dependencies" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "kb_task_files" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "kb_tasks" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "meet_chat_messages" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "meet_meetings" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "meet_participants" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "notif_notifications" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "notif_push_subscriptions" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "notif_settings" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "strat_goals" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "strat_macro_tasks" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "strat_objectives" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "strat_phase_scope_boards" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "strat_plan_phases" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "strat_plans" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "tkt_comments" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "tkt_tickets" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "units" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "user_units" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "users" ADD COLUMN "tenant_id" TEXT;

-- CreateIndex on every tenant_id column
CREATE INDEX "audit_entries_tenant_id_idx" ON "audit_entries"("tenant_id");
CREATE INDEX "chat_custom_emojis_tenant_id_idx" ON "chat_custom_emojis"("tenant_id");
CREATE INDEX "chat_group_members_tenant_id_idx" ON "chat_group_members"("tenant_id");
CREATE INDEX "chat_groups_tenant_id_idx" ON "chat_groups"("tenant_id");
CREATE INDEX "chat_huddles_tenant_id_idx" ON "chat_huddles"("tenant_id");
CREATE INDEX "chat_message_bookmarks_tenant_id_idx" ON "chat_message_bookmarks"("tenant_id");
CREATE INDEX "chat_message_reactions_tenant_id_idx" ON "chat_message_reactions"("tenant_id");
CREATE INDEX "chat_messages_tenant_id_idx" ON "chat_messages"("tenant_id");
CREATE INDEX "chat_reminders_tenant_id_idx" ON "chat_reminders"("tenant_id");
CREATE INDEX "consent_user_consents_tenant_id_idx" ON "consent_user_consents"("tenant_id");
CREATE INDEX "doc_documents_tenant_id_idx" ON "doc_documents"("tenant_id");
CREATE INDEX "doc_folders_tenant_id_idx" ON "doc_folders"("tenant_id");
CREATE INDEX "imp_task_impediments_tenant_id_idx" ON "imp_task_impediments"("tenant_id");
CREATE INDEX "kb_boards_tenant_id_idx" ON "kb_boards"("tenant_id");
CREATE INDEX "kb_columns_tenant_id_idx" ON "kb_columns"("tenant_id");
CREATE INDEX "kb_task_checklists_tenant_id_idx" ON "kb_task_checklists"("tenant_id");
CREATE INDEX "kb_task_dependencies_tenant_id_idx" ON "kb_task_dependencies"("tenant_id");
CREATE INDEX "kb_task_files_tenant_id_idx" ON "kb_task_files"("tenant_id");
CREATE INDEX "kb_tasks_tenant_id_idx" ON "kb_tasks"("tenant_id");
CREATE INDEX "meet_chat_messages_tenant_id_idx" ON "meet_chat_messages"("tenant_id");
CREATE INDEX "meet_meetings_tenant_id_idx" ON "meet_meetings"("tenant_id");
CREATE INDEX "meet_participants_tenant_id_idx" ON "meet_participants"("tenant_id");
CREATE INDEX "notif_notifications_tenant_id_idx" ON "notif_notifications"("tenant_id");
CREATE INDEX "notif_push_subscriptions_tenant_id_idx" ON "notif_push_subscriptions"("tenant_id");
CREATE INDEX "notif_settings_tenant_id_idx" ON "notif_settings"("tenant_id");
CREATE INDEX "strat_goals_tenant_id_idx" ON "strat_goals"("tenant_id");
CREATE INDEX "strat_macro_tasks_tenant_id_idx" ON "strat_macro_tasks"("tenant_id");
CREATE INDEX "strat_objectives_tenant_id_idx" ON "strat_objectives"("tenant_id");
CREATE INDEX "strat_phase_scope_boards_tenant_id_idx" ON "strat_phase_scope_boards"("tenant_id");
CREATE INDEX "strat_plan_phases_tenant_id_idx" ON "strat_plan_phases"("tenant_id");
CREATE INDEX "strat_plans_tenant_id_idx" ON "strat_plans"("tenant_id");
CREATE INDEX "tkt_comments_tenant_id_idx" ON "tkt_comments"("tenant_id");
CREATE INDEX "tkt_tickets_tenant_id_idx" ON "tkt_tickets"("tenant_id");
CREATE INDEX "units_tenant_id_idx" ON "units"("tenant_id");
CREATE INDEX "user_units_tenant_id_idx" ON "user_units"("tenant_id");
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
