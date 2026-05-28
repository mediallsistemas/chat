-- Fase 3: índice no parent_id para acelerar listagem de threads e contagem
-- de replies.
CREATE INDEX "chat_messages_reply_to_id_idx" ON "chat_messages" ("reply_to_id");
