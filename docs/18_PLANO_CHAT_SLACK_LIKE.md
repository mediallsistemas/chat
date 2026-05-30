# 18. Plano: Chat Slack-like

**Escopo:** evoluir o domínio de chat do Mediall Brasil pra fechar lacunas vs Slack, **mais** chat in-call dentro de reuniões (ponto de cruzamento entre chat e meetings).
**Fora do escopo:** demais features de reuniões (breakout, raise hand, polls, captions ao vivo, whiteboard, host controls) — plano separado.
**Estimativas:** dias-dev de uma pessoa full-time. Multiplicar conforme realidade do time.

Referências:
- Domínio atual: [06_COMUNICACAO_CHAT.md](06_COMUNICACAO_CHAT.md)
- Schema: [apps/backend/prisma/schema/chat.prisma](../apps/backend/prisma/schema/chat.prisma)
- Service: [apps/backend/src/contexts/chat/messages/messages.service.ts](../apps/backend/src/contexts/chat/messages/messages.service.ts)
- UI: [apps/frontend/src/app/(auth)/mensagens/page.tsx](../apps/frontend/src/app/(auth)/mensagens/page.tsx)

---

## Convenções do projeto (aderência obrigatória)

Auditadas contra [CLAUDE.md](../CLAUDE.md) e [17_PLANO_MODULAR_MONOLITH.md](17_PLANO_MODULAR_MONOLITH.md):

- **Estrutura backend**: cada feature nova vai em `apps/backend/src/contexts/chat/<feature>/` com `<feature>.module.ts`, `<feature>.service.ts`, `<feature>.controller.ts`, `dto/`, `events/`. Submódulo importado pelo `ChatModule`.
- **Rotas**: sempre `units/:unitId/...` via `BaseUnitController` — **sem rotas `/me/*`**. Bookmarks, status custom, emojis customizados são todos unit-scoped (você só interage com recursos da sua unit ativa).
- **Schema Prisma multi-arquivo**: modelos vão no arquivo do contexto correto.
  - Bookmark, CustomEmoji → [chat.prisma](../apps/backend/prisma/schema/chat.prisma)
  - Campos de status custom → [_shared.prisma](../apps/backend/prisma/schema/_shared.prisma) no `User`
  - Huddle → [chat.prisma](../apps/backend/prisma/schema/chat.prisma) (ou novo `huddles.prisma` se crescer)
- **Shared types**: toda entidade nova precisa de tipo em `packages/types` exportado como `@mediall/types`.
- **Frontend hooks**: existe **duplicação** entre `src/hooks/use-chat.ts` e `src/features/chat/hooks/use-chat.ts` (transição feature-first em andamento). **Decisão:** editar AMBOS até consolidação ser feita em PR separado.
- **Naming**: funções/colunas em inglês; UI em português.
- **Secrets externos**: o projeto não tem padrão claro pra API keys de terceiros no chat — features que dependam disso (ex: `/giphy`) ficam **cortadas** até decisão de produto.

---

## Resumo das fases

| Fase | Esforço | ROI | Bloqueador? |
|------|---------|-----|-------------|
| 1 — Quick wins | 4-6d | Alto (vários pequenos) | Não |
| 2 — Busca | 3-4d | Muito alto | Não |
| 3 — Threads visuais | 3-4d | Alto | Mudança de UX |
| 4 — Canais públicos | 2-3d | Médio | Decisão de produto |
| 5 — Huddles | 5-7d | Médio-alto | Custo LiveKit |
| 6 — Chat in-call (reunião) | 2-3d | Alto | Toca domínio de meetings |

**Total: ~19-27 dias-dev.**

**Ordem sugerida:** 1 → 2 → 3 → 6 → 4 → 5.
Justificativa: busca antes de threads porque thread sem busca ainda perde conhecimento; threads antes de chat in-call porque thread é problema diário; chat in-call antes de huddle porque é menor e ataca lacuna óbvia das reuniões; huddle por último (spike de custo LiveKit).

---

## Fase 1 — Quick wins (≈ 4-6 dias)

Features pequenas, alto ROI, zero risco arquitetural.

### 1.1 Typing indicators ✅ **JÁ IMPLEMENTADO**

- Hook `useTypingIndicator` em [use-chat.ts:293](../apps/frontend/src/hooks/use-chat.ts) emite `message:typing` com debounce 2s.
- Handler `@SubscribeMessage('message:typing')` em [app.gateway.ts:97](../apps/backend/src/infrastructure/gateway/app.gateway.ts) faz broadcast pra `group:${groupId}`.
- Indicador visual em [mensagens/page.tsx:744](../apps/frontend/src/app/(auth)/mensagens/page.tsx) (três bolinhas animadas).
- **Nada a fazer.**

### 1.2 Mensagens salvas / Bookmarks (1d)

- Modelo `MessageBookmark` em [chat.prisma](../apps/backend/prisma/schema/chat.prisma) → tabela `chat_message_bookmarks(id, user_id, message_id, unit_id, created_at)` — unique `(user_id, message_id)`. `unit_id` denormalizado pra simplificar filtragem multi-unit.
- Módulo `contexts/chat/bookmarks/` (service + controller + dto).
- Endpoints (unit-scoped, sob `BaseUnitController`):
  - `POST /units/:unitId/chat/bookmarks` body `{ messageId }`
  - `DELETE /units/:unitId/chat/bookmarks/:messageId`
  - `GET /units/:unitId/chat/bookmarks?cursor=<id>` (paginado, PAGE_SIZE=40)
- Tipo `MessageBookmark` em `@mediall/types`.
- UI: ícone bookmark no `MessageBubble`, página `/mensagens/salvos`. Hooks `useBookmarks`, `useToggleBookmark` em ambas cópias de `use-chat.ts`.

### 1.3 Status custom do usuário (1d)

- Adicionar campos em `User` ([_shared.prisma](../apps/backend/prisma/schema/_shared.prisma)): `customStatus` (string?), `customStatusEmoji` (string?), `statusExpiresAt` (DateTime?).
- Endpoint `PATCH /users/me/status` em `users.controller.ts` (status é per-user, não per-unit — exceção justificada à regra unit-scoped).
- Job `node-cron` horário pra limpar status expirados (arquivo em `apps/backend/src/jobs/`).
- Tipo `UserStatus` em `@mediall/types`, payload incluído no `User` retornado.
- UI: dropdown no avatar do header com presets: "Em reunião", "Almoço", "Offline hoje" + custom.

### 1.4 Emojis customizados (1.5d)

- Modelo `CustomEmoji` em [chat.prisma](../apps/backend/prisma/schema/chat.prisma) → tabela `chat_custom_emojis(id, unit_id, shortcode, file_key, created_by, created_at)` — unique `(unit_id, shortcode)`.
- Módulo `contexts/chat/custom-emojis/`.
- Endpoints (unit-scoped):
  - `POST /units/:unitId/chat/custom-emojis` (admin only via `@Roles()` — upload via FilesService → MinIO)
  - `GET /units/:unitId/chat/custom-emojis` (lista)
  - `DELETE /units/:unitId/chat/custom-emojis/:id` (admin only)
- Tipo `CustomEmoji` em `@mediall/types`.
- Reuso do parser de mention atual pra detectar `:shortcode:` em `renderContent()` e substituir por `<img>` com signed URL.
- Cache de `shortcode → URL` no frontend (TanStack Query, key `['custom-emojis', unitId]`).
- **Permissão pra criar**: admin da unit (decisão pendente já registrada).

### 1.5 Slash commands base (1d)

- Detector client-side: linha que começa com `/`. Parser `[command, ...args]`.
- Comandos v1 (sem dependências externas):
  - `/me <ação>` — mensagem em itálico em terceira pessoa (puro client-side)
  - `/shrug` — envia "¯\\_(ツ)_/¯"
  - `/remind <time> <text>` — cria notificação agendada via BullMQ (reusa infra de `apps/backend/src/jobs/`)
- **`/giphy` cortado da v1** — sem padrão de secrets externos no chat. Voltar quando produto definir política.
- **Não persiste** o comando — transforma em mensagem normal ou ação direta.
- Extensível: registry `Map<string, (args, ctx) => Action>` pra adicionar `/poll`, `/task` depois.
- Backend: endpoint `POST /units/:unitId/chat/reminders` em novo módulo `contexts/chat/reminders/` (cria job BullMQ + persiste em `chat_reminders` pra cancelamento).

---

## Fase 2 — Busca em mensagens (≈ 3-4 dias)

Lacuna mais crítica. Postgres FTS (decidido) é suficiente até alguns milhões de mensagens.

### 2.1 Migração de schema (0.5d)

Adicionar coluna gerada no `chat_messages`:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE chat_messages
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', unaccent(coalesce(content, '')))) STORED;

CREATE INDEX chat_messages_search_idx ON chat_messages USING GIN (search_vector);
```

Prisma: declarar como `Unsupported("tsvector")` ou manter só via migration raw.

### 2.2 Endpoint de busca (1.5d)

`GET /units/:unitId/chat/search?q=<termo>&groupId=<opcional>&from=<date>&to=<date>&cursor=<id>`

- Filtro de segurança: **sempre** restringe a grupos onde o user é membro (subquery em `chat_group_members`).
- Query usa `plainto_tsquery('portuguese', unaccent($1))` + `ts_rank` pra ordenar relevância.
- Retorna mensagem + snippet com `ts_headline` (highlight do termo).
- Paginação cursor-based mantendo padrão do projeto (PAGE_SIZE=40).

### 2.3 UI de busca (1-1.5d)

- Campo de busca no header do `/mensagens` (atalho `Ctrl+K` dentro do contexto).
- Resultados em painel lateral: snippet, grupo, autor, timestamp.
- Click → abre o grupo e scrolla pra mensagem (precisa de `?messageId=` na rota).
- Filtros: "neste grupo" / "todos os grupos", "últimos 7d/30d/sempre".

### 2.4 Decisão arquitetural

Indexação síncrona via coluna gerada — Postgres reindexa em cada INSERT/UPDATE. Sem job de reindex, sem dependência externa. Migrar pra Meilisearch/Typesense só se a busca virar gargalo medido.

---

## Fase 3 — Threads visuais (≈ 3-4 dias)

O modelo já tem `replyToId` self-referencing — falta a UX de painel lateral.

### 3.1 Backend: thread parent + count (1d)

- Adicionar `@@index([replyToId])` no `Message`.
- Endpoint `GET /units/:unitId/groups/:groupId/messages/:messageId/thread` — retorna parent + todas as replies em ordem cronológica.
- Modificar `findByGroup` em [messages.service.ts](../apps/backend/src/contexts/chat/messages/messages.service.ts):
  - Incluir `_count.replies` na timeline principal.
  - Excluir mensagens que são reply (`replyToId: null`) — replies só aparecem no painel da thread.
- Notificação: quem participou da thread (sender do parent + qualquer um que já respondeu) recebe notificação em novas replies, mesmo sem @mention.

### 3.2 UI: painel lateral (2d)

- Click em "Responder" abre `ThreadPanel` à direita (split layout em `/mensagens`).
- Reusa o `MessageBubble` dentro do painel.
- Indicador inline na timeline principal: "💬 5 respostas · última há 2h" → click reabre o painel.
- Estado URL: `?thread=<messageId>` pra deep-link.

### 3.3 Migration cuidadosa

Hoje replies aparecem inline com preview do `replyTo`. Mudança quebra UX existente.

**Sugestão:** feature flag `THREADS_V2` por unit no início — testar numa unit antes de roll-out geral. Alternativa: backfill marcando replies antigas como "soltas" (mantém inline) e novas vão pra thread.

---

## Fase 4 — Canais públicos descobríveis (≈ 2-3 dias)

### 4.1 Schema (0.5d)

Adicionar `visibility` ao `Group`: enum `PRIVATE_INVITE | UNIT_PUBLIC`.
- `PRIVATE_INVITE` = comportamento atual (precisa de membership pra ver/entrar).
- `UNIT_PUBLIC` = qualquer user da unit pode entrar sozinho.

Default `PRIVATE_INVITE` pra não quebrar grupos existentes.

### 4.2 Backend (1d)

- `GET /units/:unitId/groups/discoverable` — lista grupos `UNIT_PUBLIC` não-arquivados que o user ainda não é membro.
- `POST /units/:unitId/groups/:groupId/join` — adiciona o user como `MEMBER` se grupo é `UNIT_PUBLIC`.
- Ajustar `findAll` em [groups.service.ts](../apps/backend/src/contexts/chat/groups/groups.service.ts): user vê grupos onde é membro **OU** grupos `UNIT_PUBLIC` (com flag `isMember: false` no payload).

### 4.3 UI (1d)

- Tab "Descobrir" na sidebar de `/mensagens`. Lista cards com nome, descrição, contagem de membros, botão "Entrar".
- Ao criar grupo, toggle "Público nesta unidade".

---

## Fase 5 — Huddles / voz efêmera (≈ 5-7 dias)

Mais complexa — usa LiveKit que já existe no projeto pra reuniões.

### 5.0 Pré-spike: acoplamento LiveKit ↔ Meeting (0.5d)

Antes de codar: auditar se o módulo de meetings expõe um helper genérico pra gerar tokens LiveKit ou se está acoplado ao schema `Meeting`. Se acoplado, refactor pra extrair `LiveKitTokenService` reusável **antes** de prosseguir. Sem isso, huddle vira fork do código de meetings.

### 5.1 Modelagem (1d)

Tabela `chat_huddles(id, group_id, started_by, started_at, ended_at, livekit_room_id)`.

Huddle é **efêmero** — sem agendamento, sem gravação. Sala LiveKit criada on-demand, destruída quando esvazia.

Difere de `Meeting` (que é agendada, gravada, com participants formais).

### 5.2 Backend (1.5d)

- `POST /units/:unitId/groups/:groupId/huddle/start` — cria huddle, gera token LiveKit (audio-only por default, 1h TTL), publica `HuddleStartedEvent`.
- `POST /huddles/:huddleId/join` — gera token pro user atual.
- `POST /huddles/:huddleId/leave` — apenas evento socket; sala destrói via webhook LiveKit `room_empty`.
- Webhook handler pra fechar `ended_at` quando sala esvazia.

### 5.3 UI (2-3d)

- Botão "🎧 Iniciar huddle" no header do grupo.
- Banner persistente quando huddle ativo: "🎧 João + 2 estão em huddle · [Entrar]".
- Mini-player flutuante (canto inferior) com mute/leave — não bloqueia navegação entre grupos.
- Componente reusa SDK LiveKit já presente no projeto (audio tracks apenas; `video: false` no `connect`).

### 5.4 Riscos

- Concorrência com reuniões agendadas — UX precisa diferenciar visualmente.
- Custo de banda LiveKit (audio-only é baixo, mas se virar comum precisa monitorar).

---

## Fase 6 — Chat in-call (reunião) (≈ 2-3 dias)

Mensagens trocadas **durante** uma reunião LiveKit ativa. Lacuna óbvia hoje: participantes não conseguem compartilhar link, fazer pergunta sem interromper a fala, ou deixar registro escrito.

### 6.1 Decisão arquitetural: persistir ou efêmero?

Duas opções com trade-off claro:

| Abordagem | Prós | Contras |
|-----------|------|---------|
| **A. Reusar `Message` + grupo da reunião** | Histórico persistido junto com a transcrição; aparece no chat do grupo dono da reunião; busca da Fase 2 já funciona | Mistura conversa in-call com conversa do grupo "normal" — pode poluir |
| **B. Tabela dedicada `meeting_chat_messages`** | Isolamento visual claro; pode descartar após N dias | Duplica modelo de chat; busca precisa estender |
| **C. LiveKit DataChannel puro (efêmero)** | Zero backend novo; latência mínima | Não persiste; some quando reunião termina; sem replay na gravação |

**Recomendação:** **B (tabela dedicada)** — separação limpa, deixa a transcrição da reunião contar a história e o chat in-call vira anexo navegável no replay. Custo marginal vs A é baixo porque reusa o `MessageBubble`.

### 6.2 Schema (0.5d)

```prisma
model MeetingChatMessage {
  id        String   @id @default(uuid())
  meetingId String   @map("meeting_id")
  senderId  String   @map("sender_id")
  content   String
  createdAt DateTime @default(now()) @map("created_at")

  meeting Meeting @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  sender  User    @relation(fields: [senderId], references: [id])

  @@index([meetingId, createdAt])
  @@map("meeting_chat_messages")
}
```

Sem reactions, edit, delete, anexos nesta v1 — escopo enxuto. Adicionar depois se houver demanda.

### 6.3 Backend (1d)

- `POST /units/:unitId/meetings/:meetingId/chat` — guard: user deve ser participante da reunião (`MeetingParticipant`) **e** a reunião deve estar `IN_PROGRESS`.
- `GET /units/:unitId/meetings/:meetingId/chat?cursor=<id>` — histórico paginado (PAGE_SIZE=40), acessível mesmo após reunião terminar (pra quem participou).
- Evento Socket.IO `meeting-chat:message` na sala `meeting:${meetingId}` — broadcast em tempo real pros participantes conectados.
- Reusa `MessageSentEvent` pattern do chat normal? **Não** — evento dedicado pra simplificar handler client-side.

### 6.4 UI (1-1.5d)

- Painel lateral na `video-room.tsx` ([apps/frontend/src/app/(auth)/reunioes/[meetingId]/video-room.tsx](../apps/frontend/src/app/(auth)/reunioes/[meetingId]/video-room.tsx)):
  - Toggle "💬 Chat" no header da sala — abre painel à direita (overlay no mobile, split no desktop).
  - Badge com contador de não-lidas quando painel fechado.
  - Auto-scroll ao receber mensagem se painel aberto.
- Reusa componente de input do chat principal (mesmo handler de Enter pra enviar, Shift+Enter pra quebra de linha).
- Indicador "fulano está digitando…" via LiveKit DataChannel (sem persistência, igual Fase 1.1).
- **Após o fim da reunião:** botão "Ver chat" na página do meeting passado ([apps/frontend/src/app/(auth)/reunioes/[meetingId]/page.tsx](../apps/frontend/src/app/(auth)/reunioes/[meetingId]/page.tsx)) abre o histórico read-only.

### 6.5 Integração com transcrição/gravação

- A transcrição estruturada (Claude) **não** consome chat in-call por default — são canais separados (fala vs escrita). Adicionar como contexto opcional na v2 se melhorar qualidade do resumo.
- No replay da gravação (futuro): timeline com chat in-call sincronizado por timestamp. **Fora do escopo desta fase** — anotar como melhoria futura.

### 6.6 Riscos / pontas soltas

- **Quem vê o histórico depois?** Decisão: apenas quem foi `MeetingParticipant` com `attendedAt != null`. Não quem foi só convidado.
- **Mensagens enviadas antes da reunião começar?** Bloquear no guard — só aceita durante `IN_PROGRESS`. Pre-meeting chat usa o grupo dono da reunião.
- **Reuniões sem grupo dono (1-to-1 ad-hoc)?** Verificar se modelo `Meeting` exige grupo. Se sim, sem problema. Se não, garantir que `meetingId` é a única chave.

---

## Decisões já tomadas

- **Busca:** Postgres FTS (`tsvector` + GIN), sem serviço externo.
- **LiveKit:** usar features nativas quando existirem (huddle = DataChannel + audio tracks; chat in-call de reuniões usaria mesma stack).
- **Escopo desta rodada:** somente chat. Reuniões (breakout, raise hand, polls, captions ao vivo) ficam pra plano posterior.

## Decisões pendentes

- Cobertura de feature flag pra Fase 3 (threads): por unit ou global?
- Política de retenção de mensagens (limite de tempo na busca, soft-delete de huddles antigos)?
- Permissão pra criar emojis customizados (Fase 1.4) — admin da unit ou qualquer user?
