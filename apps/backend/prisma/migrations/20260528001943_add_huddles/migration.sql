-- Fase 5: huddles efêmeros de voz vinculados a um grupo.
CREATE TABLE "chat_huddles" (
    "id"              TEXT      NOT NULL,
    "group_id"        TEXT      NOT NULL,
    "unit_id"         TEXT      NOT NULL,
    "started_by"      TEXT      NOT NULL,
    "started_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at"        TIMESTAMP(3),
    "livekit_room_id" TEXT      NOT NULL,

    CONSTRAINT "chat_huddles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_huddles_livekit_room_id_key"
    ON "chat_huddles" ("livekit_room_id");

CREATE INDEX "chat_huddles_group_id_ended_at_idx"
    ON "chat_huddles" ("group_id", "ended_at");
