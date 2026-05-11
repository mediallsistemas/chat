# Plano 09 — Reuniões e Videochamadas
## Agendamento, LiveKit, WebRTC, agenda integrada

---

## Objetivo
Eliminar dependência de ferramentas externas (Zoom, Meet) com sistema proprietário de reuniões e videochamadas.

---

## Agendamento

**Campos:**
- Título, descrição, data/hora, duração estimada
- Participantes, sala ou link interno
- Grupo vinculado

**Reuniões recorrentes:**
- Diária, semanal, mensal com personalização de dias
- Sistema gera ocorrências para o próximo trimestre
- Cada ocorrência editável individualmente ou em série

**Automações:**
- Convite automático a todos os participantes ao agendar
- Lembrete 24h antes e 15 min antes
- Sala disponível 5 min antes do horário

---

## Videochamada (LiveKit + WebRTC)

- Vídeo HD, áudio, compartilhamento de tela, chat da reunião
- Salas temporárias: criadas instantaneamente sem agendamento
- Sala persistente por grupo: sempre disponível para entrar
- Gravação opcional (consentimento obrigatório de todos os participantes)
- Gravações armazenadas no MinIO
- Transcrição automática (expansão futura)

---

## Agenda Integrada

- **Visão pessoal:** todas as reuniões do usuário em todos os grupos
- **Visão do grupo:** reuniões específicas daquele grupo
- Prazos de vencimento de tarefas aparecem na agenda
- Data-limite de metas aparecem na agenda
- Exportação para iCal/Google Calendar (expansão futura)

---

## Tabelas

```
meetings
- id, title, description, group_id
- start_at, end_at, room_id (LiveKit)
- is_recurring, recurrence_rule (RRULE)
- parent_meeting_id (ocorrências)
- status: SCHEDULED|IN_PROGRESS|DONE|CANCELLED
- recording_url nullable
- unit_id

meeting_participants
- meeting_id, user_id
- status: INVITED|ACCEPTED|DECLINED|ATTENDED
- joined_at, left_at
```

---

## Checklist de Implementação

- [ ] LiveKit Server no Docker Compose
- [ ] Integração LiveKit Client SDK no Next.js
- [ ] CRUD de reuniões
- [ ] Reuniões recorrentes com RRULE
- [ ] Sala persistente por grupo
- [ ] Sala temporária instantânea
- [ ] Gravação com consentimento
- [ ] Agenda integrada (reuniões + prazos de tarefas)
- [ ] Lembretes automáticos (24h e 15min)
- [ ] Permissões de câmera/microfone
- [ ] Isolamento por unidade
