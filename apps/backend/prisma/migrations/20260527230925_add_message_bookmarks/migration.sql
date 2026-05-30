-- Fase 1.2: mensagens salvas (bookmarks).
CREATE TABLE "chat_message_bookmarks" (
    "id"         TEXT      NOT NULL,
    "user_id"    TEXT      NOT NULL,
    "message_id" TEXT      NOT NULL,
    "unit_id"    TEXT      NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_bookmarks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_message_bookmarks_user_id_unit_id_created_at_idx"
    ON "chat_message_bookmarks" ("user_id", "unit_id", "created_at");

CREATE UNIQUE INDEX "chat_message_bookmarks_user_id_message_id_key"
    ON "chat_message_bookmarks" ("user_id", "message_id");

ALTER TABLE "chat_message_bookmarks"
    ADD CONSTRAINT "chat_message_bookmarks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_message_bookmarks"
    ADD CONSTRAINT "chat_message_bookmarks_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "chat_messages" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
