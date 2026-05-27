-- Fase 2: busca full-text em chat_messages.
-- Usa unaccent + dicionário 'portuguese'. unaccent é STABLE no Postgres
-- por default, então uma coluna GENERATED não funciona — usamos trigger.

CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE "chat_messages"
    ADD COLUMN "search_vector" tsvector;

CREATE INDEX "chat_messages_search_vector_idx"
    ON "chat_messages" USING GIN ("search_vector");

CREATE OR REPLACE FUNCTION chat_messages_search_update()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        to_tsvector('portuguese', unaccent(coalesce(NEW.content, '')));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_messages_search_vector_trg
    BEFORE INSERT OR UPDATE OF content ON "chat_messages"
    FOR EACH ROW EXECUTE FUNCTION chat_messages_search_update();

-- Backfill existing rows.
UPDATE "chat_messages"
SET search_vector = to_tsvector('portuguese', unaccent(coalesce(content, '')))
WHERE search_vector IS NULL;
