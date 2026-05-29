---
name: comunicacao-chat-completo
description: Módulo 06 — Comunicação e Chat completamente implementado (grupos, mensagens, WebSocket, presença Redis, threads, reações, silenciar, 1:1)
metadata:
  type: project
---

# Plano 06 — Comunicação e Chat: Concluído

## O que foi implementado

### Infraestrutura WebSocket
- Socket.IO com autenticação JWT no handshake
- Redis adapter para horizontal scaling (`@socket.io/redis-adapter`)
- Auto-join em rooms `unit:<unitId>` ao conectar

### Presença online via Redis
- `PresenceService`: Redis SADD/SREM/SMEMBERS em `online:unit:<unitId>` com TTL de 24h
- Fallback in-memory quando Redis indisponível
- `PresenceController`: `GET /units/:unitId/presence` retorna IDs online daquela unidade
- Gateway chama `markOnline/markOffline` em `handleConnection/handleDisconnect`

### Grupos e mensagens
- CRUD completo: GENERAL / SECTOR / SUBSECTOR / PROJECT / TEMPORARY / PRIVATE
- Hierarquia por `parentId`
- Isolamento por `unitId`
- Threads via `replyToId`
- Mensagens fixadas (togglePin)
- Busca por palavra-chave
- Reações emoji
- Upload de arquivos no chat
- Conversas privadas 1:1 (POST /groups/direct)

### Funcionalidades em tempo real
- `message:new`, `message:edited`, `message:deleted`, `message:reaction`
- `user:typing` broadcast
- `message:read` com `lastReadAt` em GroupMember + contagem de membros

### Painéis laterais
- Membros: `GET /groups/:groupId/members`
- Arquivos: `GET /groups/:groupId/files` com signed URLs

### Silenciar grupos
- Toggle via `NotificationSettings` API, persistido por usuário

### Arquivamento automático
- `GroupArchiveJob` cron 23:55 arquiva grupos TEMPORARY expirados
- Notificação 7 dias antes + 1 dia antes

### Auditoria
- `isEdited/isDeleted` preservado em `Message`
- Todas as mutações passam pelo `AuditLogInterceptor` global
