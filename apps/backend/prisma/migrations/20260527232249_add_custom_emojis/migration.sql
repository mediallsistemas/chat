-- Fase 1.4: emojis customizados por unidade.
CREATE TABLE "chat_custom_emojis" (
    "id"         TEXT      NOT NULL,
    "unit_id"    TEXT      NOT NULL,
    "shortcode"  TEXT      NOT NULL,
    "file_key"   TEXT      NOT NULL,
    "created_by" TEXT      NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_custom_emojis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_custom_emojis_unit_id_shortcode_key"
    ON "chat_custom_emojis" ("unit_id", "shortcode");

CREATE INDEX "chat_custom_emojis_unit_id_idx"
    ON "chat_custom_emojis" ("unit_id");
