-- Fase 6: chat in-call durante reuniões.
CREATE TABLE "meet_chat_messages" (
    "id"         TEXT      NOT NULL,
    "meeting_id" TEXT      NOT NULL,
    "sender_id"  TEXT      NOT NULL,
    "content"    TEXT      NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meet_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "meet_chat_messages_meeting_id_created_at_idx"
    ON "meet_chat_messages" ("meeting_id", "created_at");

ALTER TABLE "meet_chat_messages"
    ADD CONSTRAINT "meet_chat_messages_meeting_id_fkey"
    FOREIGN KEY ("meeting_id") REFERENCES "meet_meetings" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meet_chat_messages"
    ADD CONSTRAINT "meet_chat_messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users" ("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;
