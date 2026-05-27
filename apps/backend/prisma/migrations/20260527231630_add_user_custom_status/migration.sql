-- Fase 1.3: status custom do usuário.
ALTER TABLE "users"
    ADD COLUMN "custom_status"       TEXT,
    ADD COLUMN "custom_status_emoji" TEXT,
    ADD COLUMN "status_expires_at"   TIMESTAMP(3);
