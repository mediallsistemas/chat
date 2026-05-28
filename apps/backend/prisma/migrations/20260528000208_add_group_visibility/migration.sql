-- Fase 4: canais públicos descobríveis dentro da unidade.
CREATE TYPE "GroupVisibility" AS ENUM ('PRIVATE_INVITE', 'UNIT_PUBLIC');

ALTER TABLE "chat_groups"
    ADD COLUMN "visibility" "GroupVisibility" NOT NULL DEFAULT 'PRIVATE_INVITE';
