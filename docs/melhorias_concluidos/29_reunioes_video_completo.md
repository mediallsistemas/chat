---
name: reunioes-video-completo
description: Módulo 09 — Reuniões e Videochamadas completamente implementado (LiveKit, recorrência, gravação, agenda)
metadata:
  type: project
---

# Plano 09 — Reuniões e Videochamadas: Concluído

## O que foi implementado

### Backend
- `MeetingsModule` — CRUD completo: `GET/POST/PATCH/DELETE /units/:unitId/meetings`
- Reuniões recorrentes com RRULE — `generateOccurrences()` em `meetings.service.ts`
- Sala persistente por grupo — `GET /meetings/group-room/:groupId`
- Sala temporária instantânea — `POST /meetings/instant-room`
- Gravação com consentimento — `RecordingConsentRequestedEvent` + `EgressClient` LiveKit; gravação só inicia após todos os participantes consentirem
- `MeetingReminderJob` — cron que envia lembretes 24h e 15min antes da reunião
- Isolamento por unidade em todos os endpoints

### Frontend
- `/reunioes` — lista de reuniões com modal de criação (título, data, participantes, recorrência)
- `/reunioes/agenda` — calendário mensal com reuniões + prazos de tarefas
- `/reunioes/[meetingId]` — detalhe da reunião + sala de vídeo LiveKit
- `video-room.tsx` — controles de câmera/microfone, participantes, gravação
- `@livekit/components-react` integrado no Next.js

### Infra
- LiveKit Server no Docker Compose
