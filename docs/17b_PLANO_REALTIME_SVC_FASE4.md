# Plano 17 — Fase 4: Extrair realtime-svc (chat + meetings)

> Status: planejado, **NÃO implementar até Fase 3 aprovar**
> Pré-requisito: relatório de observação Fase 3 indica viabilidade
> Escopo: extrair chat + meetings + Socket.IO gateway para serviço próprio

## Decisão pendente

Esta fase só executa se o relatório de observação da Fase 3 mostrar:
1. transcription-svc estável por ≥2 semanas
2. Carga real-time saturando o monolito (WebSocket conexões, latência subindo)
3. Operação distribuída tolerável pelo time

Se algum critério não bater, **parar no resultado da Fase 2** (monolito modular
com 1 serviço extraído já é resultado válido do plano 17).

## Por que chat+meetings juntos (não separados)

Compartilham:
- Socket.IO Gateway (precisaria duplicar ou extrair em comum)
- Grupos (meetings referencia Group, chat também)
- Presença de usuário
- Notificações de evento em tempo real

Separá-los exigiria coordenação cross-service constante. Juntos viram um único
"serviço real-time" coeso.

## Estrutura proposta

```
apps/
├── backend/             ← monolito (sem chat, sem meetings, sem socket gateway)
├── transcription-svc/   ← já extraído
└── realtime-svc/        ← NOVO
    ├── src/
    │   ├── chat/        ← groups, messages, reactions
    │   ├── meetings/    ← meetings, participants, livekit integration
    │   ├── presence/    ← user online/offline
    │   ├── gateway/     ← Socket.IO server
    │   ├── streams/     ← Redis Streams publisher/consumer
    │   └── main.ts
    ├── prisma/
    │   └── schema/
    │       ├── _datasource.prisma
    │       ├── chat.prisma          ← copiado de backend
    │       ├── meetings.prisma      ← copiado de backend
    │       └── _shared.prisma       ← User snapshot, Unit snapshot (READ-ONLY)
    ├── Dockerfile
    └── package.json
```

## Schema separation

- Tabelas `groups`, `group_members`, `messages`, `message_reactions`,
  `meetings`, `meeting_participants` migram para **schema Postgres dedicado**
  (search_path `realtime`)
- Monolito perde acesso direto a essas tabelas (boundary lint reforça)
- User/Unit continuam no schema `public` (monolito é dono); realtime-svc lê
  via HTTP `GET /internal/v1/users/:id` e `/units/:id`

## Comunicação

### Async (Redis Streams)

Monolito → realtime-svc:
- `stream:strategic.objective_updated.v1` — para invalidar mentions em chat
- `stream:units.user_added.v1` — adicionar user a grupos default
- `stream:notifications.delivered.v1` — atualizar badge no socket

realtime-svc → monolito:
- `stream:meetings.recording_ready.v1` — já existe (atualmente publicado pelo monolito)
- `stream:notifications.notify_user.v1` — já existe
- `stream:meetings.scheduled.v1` — calendário no monolito atualiza
- `stream:chat.message_with_mention.v1` — monolito processa @mentions e cria notification

### Sync (HTTP)

realtime-svc → monolito (internal API):
- `GET /internal/v1/users/:id` — snapshot User
- `GET /internal/v1/units/:id` — snapshot Unit
- `GET /internal/v1/users/:id/units` — units a que user tem acesso

monolito → realtime-svc:
- `GET /internal/v1/chat/groups/by-user/:userId` — listar grupos (para sidebar do dashboard, se necessário)

## Frontend impact

- `socket.io-client` no frontend conecta em URL diferente (configurável via
  `NEXT_PUBLIC_WS_URL=wss://realtime.mediall.com.br`)
- Resto das rotas REST continua apontando para monolito
- TanStack Query: chats/meetings hooks chamam `realtime-svc`, outros chamam monolito
- Mudança em `apps/frontend/src/shared/lib/api.ts`: criar segundo cliente axios
  `realtimeApi` apontando para `process.env.NEXT_PUBLIC_REALTIME_URL`

## Migração sem downtime

1. Deploy `realtime-svc` em paralelo, lendo/escrevendo **mesmo Postgres** ainda
2. Feature flag `REALTIME_VIA_SVC=false` no frontend: rotas chat/meetings
   continuam batendo no monolito
3. Quando o svc estiver estável: flip flag para `true` por unidade (canary)
4. Após todas as unidades migradas: remover código de chat/meetings do monolito
5. Por último: separar schema Postgres (search_path) — última etapa, mais arriscada

## Riscos específicos desta fase

| Risco | Mitigação |
|---|---|
| WebSocket sticky session entre 2 serviços | Cliente conecta direto em realtime-svc; nginx faz upgrade WS apenas pra esse svc |
| Presença distribuída (online/offline) | Redis Pub/Sub para sincronizar presença; já funciona se houver redis adapter (já implementado) |
| Mentions ficam quebradas (chat svc não tem acesso direto a tasks/objectives) | Manter snapshots ou consultar via HTTP — aceitar consistência eventual |
| Search cross-contexto (procurar mensagens + reuniões) | Aceitar que esse caso vira federated query no frontend, ou criar serviço de busca dedicado depois |

## Trabalho estimado

- Setup do svc + Dockerfile + CI: 2 dias
- Migração schema + scripts: 3 dias
- Internal API endpoints no monolito: 1 dia
- Refactor frontend para 2 origins: 2 dias
- Testes E2E + canary: 5 dias
- Cleanup do código antigo no monolito: 1 dia
- **Total: ~14 dias**

Comparar com o ganho mensurado na Fase 3. Se ganho < custo, parar.

## Não fazer

- ❌ Não criar terceiro serviço (notifications) — fica no monolito; é leve
- ❌ Não extrair documents/tickets/strategic — baixa carga, alta integração
- ❌ Não introduzir gRPC nem Kafka aqui — HTTP/Streams continua suficiente
- ❌ Não usar saga/orquestração — fluxos cross-svc devem ser side-effect-only
