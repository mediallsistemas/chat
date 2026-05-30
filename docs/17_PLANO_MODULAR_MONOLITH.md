# Plano — Modular Monolith Forte + Extração Seletiva

> Status: proposta
> Data: 2026-05-23
> Autor: Rafael + Claude

---

## Contexto e decisão

O backend já está em DDD modular (4 camadas por domínio em `apps/backend/src/contexts/`). A proposta inicial era ir para micro-serviços completos (1 serviço, 1 DB, 1 deploy por contexto), mas após diagnóstico decidiu-se por uma abordagem mais pragmática:

- Operação solo, sem DevOps dedicado
- Regras de negócio mudam com frequência (refactor cross-domain é comum)
- Necessidade real é **escala independente** dos pontos quentes (transcription, chat, meetings), não separação para todos
- Separação por **tabelas/schemas** já atende o requisito do usuário, sem custo operacional de N processos

### Filosofia em uma linha

> Separar tabelas por domínio + isolar comunicação via eventos > inventar micro-serviços antes da hora.

---

## Diagnóstico atual (auditoria 2026-05-23)

**Pontos críticos:**
- EventBus implementado mas **morto**: 0 publishers, 0 subscribers, 22 eventos de domínio definidos e nunca emitidos
- 5+ contextos chamam `NotificationsService` **diretamente** (chat, meetings, transcription, tickets, impediments, strategic)
- `NotificationsModule` importa `ConsentsModule` direto (acoplamento sem mediação)
- Schema Prisma: 30 models em arquivo único de 817 linhas
- `User` aparece em 11 models, `Unit` em 8+ (compartilhamento legítimo, transversal)

**Pontos bons:**
- Estrutura de pastas DDD já correta (`domain/`, `application/`, `infrastructure/`, `presentation/`)
- Frontend bem isolado em `features/`, acoplamento entre features mínimo
- 15 contextos com fronteiras claras (mesmo que não impostas pelo compilador)

**Candidatos a extração (ranking):**
1. **transcription** — acoplamento mínimo, carga pesada (Claude API), dados leves
2. **meetings** — depende só de Notifications, real-time WebSocket isolável
3. **chat** — alta concorrência real-time, mas FKs internas mais complexas

---

## Fase 1 — Fundação (1-2 semanas) — OBRIGATÓRIA

Sem essa fase, nenhuma extração futura faz sentido. É também a que dá ROI imediato mesmo sem extrair nada.

### 1.1 Reviver o EventBus

**Objetivo:** zero imports diretos entre contextos.

Substituir todas as chamadas diretas a `NotificationsService` por publicação de eventos do tipo `NotifyUserRequested` (ou eventos de domínio mais específicos: `MessagePosted`, `TaskBlocked`, `MeetingStarted`).

Mover os `*-notification.handler.ts` que hoje vivem no domínio emissor para `contexts/notifications/application/handlers/`, ouvindo via `@OnEvent`.

**Checklist:**
- [x] `chat`: `MessagesService` → publica `NotifyUserRequested` via EventBus (concluído 2026-05-23)
- [x] `meetings`: handler migrado para publicar `NotifyManyRequested` em vez de chamar Notifications
- [x] `transcription`: `TranscriptionService` → publica `TranscriptionCompleted` + `NotifyManyRequested`
- [x] `tickets`: handler migrado para EventBus
- [x] `impediments`: handler migrado para EventBus
- [x] `strategic/phases`: handler migrado para EventBus
- [x] `notifications` desacoplado de `consents` via `CONSENT_READ_PORT` (Symbol DI token)

### 1.2 Boundary enforcement (lint)

**Objetivo:** o compilador impede regressão arquitetural.

Adicionar **eslint-plugin-boundaries** OU **dependency-cruiser** no monorepo.

Regras:
- `contexts/X/**` só pode importar de: `contexts/X/**`, `shared/**`, `infrastructure/**`, `@mediall/types`, `@mediall/contracts`, `@mediall/events`
- Violação quebra o build no CI
- Exceção controlada: leituras de read-models públicos de outro contexto via porta declarada

### 1.3 Schema Prisma por domínio (multi-file)

**Objetivo:** cada domínio dono claro das suas tabelas, sem trocar de banco.

Habilitar `prismaSchemaFolder` (preview Prisma 5+).

Estrutura proposta:

```
apps/backend/prisma/
├── schema.prisma              ← datasource + generator + shared (User, Unit, UserUnit)
└── schemas/
    ├── auth.prisma            ← RefreshToken, AuditLog específico de auth
    ├── strategic.prisma       ← Plan, Objective, Goal, Phase, MacroTask
    ├── kanban.prisma          ← Board, Column, Task, TaskFile
    ├── chat.prisma            ← Group, GroupMember, Message, Reaction
    ├── meetings.prisma        ← Meeting, MeetingParticipant
    ├── transcription.prisma   ← Transcript, TranscriptSegment
    ├── notifications.prisma   ← Notification, NotificationSettings
    ├── impediments.prisma     ← Impediment, EscalationLog
    ├── tickets.prisma         ← Ticket, TicketComment
    ├── documents.prisma       ← Document, DocumentVersion
    └── consents.prisma        ← UserConsent, ConsentLog
```

**Regras adicionais:**
- Cada `contexts/<domain>/infrastructure/repositories/*.ts` só toca models do seu próprio arquivo `.prisma`
- Exceção: leitura de `User` e `Unit` (transversais, ficam no `schema.prisma` raiz)
- Migrations passam a ser organizadas por contexto (nome do arquivo de migration prefixado pelo domínio)

### 1.4 Read models e snapshots cross-domain

**Objetivo:** preparar terreno para extração — substituir joins SQL cross-domain por interfaces.

Quando `strategic` precisa do nome do usuário responsável de uma `MacroTask`:
- **Hoje:** join Prisma `MacroTask → User`
- **Depois:** `UsersReadPort.getById(userId)` ou snapshot denormalizado `macro_task.responsible_name` atualizado por handler de `UserUpdated`

Aplicar progressivamente, começando pelas leituras mais frequentes. Não precisa migrar tudo de uma vez — é refator incremental.

---

## Fase 2 — Extração do primeiro serviço (2-3 semanas)

**Candidato único e definido: `transcription`**

### Por que transcription primeiro

- Único contexto com acoplamento externo zero após Fase 1
- Workload realmente pesado (Claude API, processamento longo, picos)
- Beneficia-se de auto-scale horizontal
- Dados leves (Meeting reference + segments), sem FK quente
- Falha do serviço **não derruba o resto** do sistema
- Se a extração for um erro, é fácil reverter (rollback dois deploys)

### Estrutura proposta

```
apps/
├── backend/                ← monolito principal NestJS (todo o resto)
└── transcription-svc/      ← NestJS standalone, próprio Dockerfile, próprio deploy

packages/
├── types/                  ← já existe — DTOs e types compartilhados
├── contracts/              ← NOVO: interfaces de ports entre serviços
└── events/                 ← NOVO: schemas Zod de eventos versionados
```

### Comunicação

- **Transporte:** Redis Streams (já temos Redis para BullMQ — zero infra nova)
- **Padrão de eventos:**
  - `MeetingRecordingReady` (publicado pelo monolito) → consumido por transcription
  - `TranscriptionCompleted` (publicado por transcription) → consumido por notifications no monolito
- **Síncrono (HTTP):** apenas leituras pontuais transcription → monolito (ex: buscar metadata de Meeting). Uma rota só, autenticada com token de serviço.
- **NÃO usar:** gRPC, Kafka, RabbitMQ, service mesh

### Banco de dados

Começa com **mesmo Postgres**, schema dedicado `transcription` (search_path separado). Pode virar DB separado depois com `pg_dump` do schema e reapontar `DATABASE_URL` — zero refactor de código.

### Deploy

- Docker Compose: adicionar serviço `transcription-svc` com healthcheck próprio
- Nginx: roteamento `/transcription-svc/*` se houver endpoints públicos (provavelmente não — fala só por eventos)
- Variáveis de ambiente: `TRANSCRIPTION_SVC_URL`, `REDIS_STREAMS_URL` (mesma instância)

---

## Fase 3 — Observação e decisão (1 semana)

Antes de extrair mais qualquer coisa, medir:

- [ ] Carga do monolito reduziu mensuravelmente após transcription sair?
- [ ] Tempo gasto operando 2 deploys vs 1 — está aceitável?
- [ ] EventBus estável? Quantos eventos perdidos? Quantas reentregas?
- [ ] Algum bug cross-service apareceu? Quanto tempo levou pra diagnosticar?

**Decisão:**
- Se a dor operacional > ganho de escala → **para por aqui**. Resultado final: monolito modular com fronteiras forçadas + 1 serviço pesado isolado.
- Se ganho claro e operação tranquila → **prossegue para Fase 4**.

---

## Fase 4 — Extração condicional (só se Fase 3 aprovar)

**Próximo candidato: `meetings` + `chat` juntos** (compartilham WebSocket gateway, faz sentido extrair como par).

Estrutura adicional:
```
apps/
└── realtime-svc/           ← meetings + chat + WebSocket gateway
```

Critérios para prosseguir:
- Carga real-time documentadamente saturando o monolito
- Diretório claro de quais features dependem desses contextos
- Estratégia de migração sem downtime planejada

---

## O que NÃO faz parte do plano

| Item | Motivo |
|---|---|
| Kubernetes / service mesh | Operação solo, Docker Compose basta |
| Kafka / RabbitMQ | Redis Streams resolve nossa escala |
| API Gateway dedicado | Nginx existente cumpre o papel |
| Micro-serviço por contexto (15 serviços) | Custo operacional inviável para o time atual |
| gRPC entre serviços | HTTP/JSON + Zod é mais debugável |
| Saga / orquestrador de transações distribuídas | Evitar transações distribuídas; outbox só se necessário |
| Banco separado por contexto desde já | Schema separado resolve, sem custo de N instâncias |

---

## Ordem de execução recomendada

1. **Fase 1.1** — Reviver EventBus (maior ROI imediato, base de tudo)
2. **Fase 1.2** — Boundary lint no CI
3. **Fase 1.4** — Read models para os top 5 joins cross-domain mais frequentes
4. **Fase 1.3** — Multi-file schema Prisma
5. **Fase 2** — Extrair transcription
6. **Fase 3** — Observar
7. **Fase 4** — Decidir sobre meetings/chat

A ordem 1.1 → 1.2 → 1.4 → 1.3 é deliberada: o lint precisa entrar **antes** do split de schema, porque o split vai exigir muitos imports novos e queremos garantir que não introduzem violações.

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| EventBus introduz bugs por eventual consistency | Começar com eventos *side-effect only* (notificações). Operações críticas continuam síncronas. |
| Multi-file schema quebra `prisma migrate` | Feature ainda em preview no Prisma 5. Testar em branch separada antes. Plano B: manter schema único com seções comentadas por domínio. |
| Lint de boundaries derruba todo o build | Introduzir como `warn` por 1 sprint, depois promover para `error`. |
| Transcription extraído fica difícil de debugar | Logs estruturados com `correlationId` propagado via header/evento. Sentry compartilhado. |
| Custo de operar 2 serviços maior que ganho | É exatamente o que a Fase 3 mede — abortar é parte do plano. |

---

## Próximos passos imediatos

Quando o usuário aprovar este plano, começar por:

1. Criar branch `feat/eventbus-revival`
2. Catalogar todos os pontos de import direto entre contextos (já temos diagnóstico parcial)
3. Definir o conjunto inicial de eventos no novo `packages/events/`
4. Implementar primeiro caminho ponta-a-ponta: `MessagePosted` → handler em `notifications/`
5. Validar com testes de integração antes de migrar os outros 4-5 fluxos

---

## Status de execução (2026-05-23)

| Fase | Status | Observações |
|---|---|---|
| 1.1 EventBus revival + desacoplar Notifications/Consents | ✅ Concluída | `CONSENT_READ_PORT` + `NotifyUserRequested` + `NotifyUserRequestedHandler` |
| 1.2 Boundary lint (dependency-cruiser) | ✅ Concluída | `npm run lint:boundaries`, 0 violations |
| 1.3 Multi-file Prisma schema | ✅ Concluída | `prisma/schema/` com 13 arquivos por contexto |
| 1.4 Read Ports (Users/Units) | ✅ Concluída | `USERS_READ_PORT`, `UNITS_READ_PORT` |
| 2 Extrair transcription-svc | ✅ Concluída | `apps/transcription-svc/`, Redis Streams, docker-compose |
| 3 Observação (1 semana) | 📋 Planejado | Guia em `17a_OBSERVABILIDADE_FASE3.md` |
| 4 Extrair realtime-svc (condicional) | 📋 Planejado | Plano em `17b_PLANO_REALTIME_SVC_FASE4.md` |

### Limpeza arquitetural feita junto

A reestruturação DDD #39 (em `melhorias_concluidos/`) havia deixado **pastas
duplicadas mortas** em todos os contextos (`contexts/<X>/application/`,
`domain/`, `presentation/`) que ninguém importava. Essas pastas foram
**deletadas** durante a Fase 1. A estrutura viva é:

```
src/contexts/<X>/
  <X>.module.ts
  <X>.service.ts
  <X>.controller.ts
  events/           ← eventos de domínio
  handlers/         ← consumidores de eventos (cross-context via EventBus)
  dto/
  <feature>/        ← sub-features se houver (ex: kanban/tasks/, chat/messages/)
```

Pastas `contexts/audit/`, `contexts/auth/`, `contexts/consents/`,
`contexts/dashboard/`, `contexts/notifications/`, `contexts/reports/`,
`contexts/transcription/`, `contexts/units/`, `contexts/users/` também foram
removidas (só tinham scaffolding morto; os módulos vivos estão em
`src/<modulo>/` ou `src/infrastructure/<modulo>/`).

### Docs relacionados

- `17a_OBSERVABILIDADE_FASE3.md` — métricas a coletar antes de decidir Fase 4
- `17b_PLANO_REALTIME_SVC_FASE4.md` — plano detalhado, não implementar até Fase 3 aprovar
- `apps/transcription-svc/README.md` — operação do serviço extraído
