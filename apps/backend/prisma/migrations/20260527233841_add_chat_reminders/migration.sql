-- Fase 1.5: reminders criados via /remind no chat.
CREATE TABLE "chat_reminders" (
    "id"         TEXT      NOT NULL,
    "user_id"    TEXT      NOT NULL,
    "unit_id"    TEXT      NOT NULL,
    "group_id"   TEXT,
    "text"       TEXT      NOT NULL,
    "remind_at"  TIMESTAMP(3) NOT NULL,
    "job_id"     TEXT,
    "fired"      BOOLEAN   NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_reminders_user_id_remind_at_idx"
    ON "chat_reminders" ("user_id", "remind_at");
