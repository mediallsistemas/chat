-- Huddle lifecycle: persist the reconciled participant count and an idle
-- timer. Presence is reconciled against LiveKit (the source of truth); a call
-- with <= 1 participant for too long is auto-ended.
ALTER TABLE "chat_huddles" ADD COLUMN "participant_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "chat_huddles" ADD COLUMN "lonely_since" TIMESTAMP(3);
