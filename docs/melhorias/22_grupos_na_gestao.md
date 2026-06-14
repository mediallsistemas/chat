# 22 — Grupos Integrados à Gestão do Sistema
**Prioridade:** 🟢 Média — diferencial de produto
**Tempo estimado:** ~18h (faseável; cada integração é independente)
**Área:** Chat / Grupos × Estratégia, Impedimentos, Reuniões, Tarefas, Multi-unidade
**Pré-requisito recomendado:** plano [21](21_gestao_do_grupo.md) (gestão do próprio grupo) feito primeiro.

---

## Ideia central

O sistema **já produz eventos de gestão ricos** — impedimentos escalando, fases sendo
concluídas/desbloqueadas, tarefas criadas, reuniões agendadas, chamados atribuídos. Hoje
esses eventos viram apenas **notificações individuais** (um sininho por pessoa). A informação
de equipe se perde.

A proposta: fazer o **grupo de chat virar o "feed vivo" do trabalho daquela equipe/área/projeto**.
Em vez de o chat ser uma ilha, ele passa a ser o lugar onde a gestão **acontece e fica
registrada** — sem o usuário ter que sair para outra tela. É o mesmo princípio do Slack quando
integra Jira/GitHub: o canal certo recebe o fato certo, automaticamente.

Tudo é construído sobre o que **já existe** (o EventBus e os eventos de domínio listados abaixo),
então a integração é de baixo risco e respeita as fronteiras de contexto (`architecture.md` §1/§3).

### Eventos de domínio já emitidos (matéria-prima — verificado no código)

```
impediment.created     impediment.escalated     impediment.resolved
phase.completed        phase.unlocked           task.created   task.completed
meeting.scheduled      meeting.started          meeting.ended
ticket.assigned
```

Todos passam pelo `EventBus`. Hoje são consumidos por handlers de **notificação**.
Este plano adiciona um **segundo consumidor**: um handler que posta uma **mensagem de sistema**
no grupo certo.

---

## As integrações (escolha as que fizerem sentido; cada uma é independente)

### Integração 1 — Grupo vinculado a um Objetivo/Projeto → "feed do projeto"
**Problema que resolve:** o campo `objectiveId` em `Group` está morto. Um grupo do tipo PROJECT
deveria reunir quem trabalha num objetivo estratégico e mostrar o progresso ali.

**Como funciona:**
- Ao criar/editar um grupo, o admin pode **vincular um Objetivo** (`objectiveId`).
- Quando uma **tarefa daquele objetivo é criada/concluída** (`task.created` / `task.completed`),
  ou uma **fase é concluída/desbloqueada** (`phase.completed` / `phase.unlocked`), o sistema
  posta uma **mensagem de sistema** (`MessageType.SYSTEM`) no grupo:
  > 🟢 *Fase "Diagnóstico" concluída — a próxima fase "Execução" foi desbloqueada.*
  > ✅ *Tarefa "Mapear fluxo da recepção" concluída por Ana.*
- O cabeçalho do grupo ganha um **mini-indicador de progresso** do objetivo (barra %), lido do
  cálculo bottom-up que já existe (`CLAUDE.md` — Progresso é sempre bottom-up).

**Valor de gestão:** a equipe vê o trabalho avançar no mesmo lugar onde conversa. O gestor
abre o grupo e entende o status sem abrir o painel estratégico.

---

### Integração 2 — Impedimentos no grupo da área → "war room"
**Problema que resolve:** impedimentos escalam silenciosamente por notificação individual; a
equipe não tem um lugar comum para tratá-los.

**Como funciona:**
- Quando um impedimento é criado/escalado/resolvido (`impediment.created/escalated/resolved`),
  postar mensagem de sistema no grupo da área/objetivo relacionado:
  > 🔴 *Impedimento "Sem acesso ao sistema X" escalou para nível 2 (Gestor do setor).*
  > 🟢 *Impedimento "Sem acesso ao sistema X" foi resolvido.*
- A mensagem inclui **deep-link** para a tela de impedimentos (o chat já suporta deep-link e
  menções `@[...]`).

**Valor de gestão:** transforma o grupo em "sala de guerra" do bloqueio — histórico, responsáveis
e resolução ficam registrados no fio da conversa.

---

### Integração 3 — Reuniões do grupo → agenda e ata no fio
**Problema que resolve:** reuniões e chat são telas separadas; o vínculo `Meeting.groupId` já
existe no schema mas é subutilizado.

**Como funciona:**
- Ao agendar uma reunião a partir de um grupo (`meeting.scheduled`), postar:
  > 📅 *Reunião "Alinhamento semanal" agendada para qui 19/06 14h. [Entrar]*
- Quando a reunião termina e a **transcrição/ata fica pronta** (`meetings.recording.ready` /
  `transcription.completed`), postar o resumo no grupo com link.

**Valor de gestão:** a reunião nasce e "morre" no grupo — agenda, link de entrada e ata no
mesmo lugar. Quem faltou lê a ata no fio.

---

### Integração 4 — Hierarquia organizacional real (Setor → Subsetor)
**Problema que resolve:** `parentId`, `SECTOR`/`SUBSECTOR` são rótulos sem efeito; a UI é flat.

**Como funciona (mínimo viável, sem inventar tabela de setores):**
- Permitir, na criação/edição, **escolher um grupo pai** (`parentId`) — apenas entre grupos do
  tipo SECTOR da mesma unidade.
- A sidebar de Mensagens passa a **agrupar visualmente**: subsetores indentados sob o setor pai.
- Opcional: ao adicionar alguém a um SECTOR, sugerir adicioná-lo aos SUBSECTORs filhos.

**Valor de gestão:** o organograma de comunicação fica visível; navegação reflete a estrutura
real da unidade. Começa simples (só visual + `parentId`), sem herança de permissão complexa.

> **Decisão de produto (definida):** acesso é **independente** — estar no setor **não** adiciona
> a pessoa aos subsetores. Cada grupo (setor ou subsetor) tem sua própria lista de membros. A
> árvore é puramente **visual/organizacional**; membership continua sendo a regra de acesso.
> Sem cascata. (A regra "você vê um grupo só se for membro dele" permanece intacta.)

---

### Integração 5 — Resumo executivo do grupo para a Diretoria (multi-unidade)
**Problema que resolve:** a Diretoria (acesso GLOBAL) não tem visão consolidada da atividade
de comunicação entre unidades.

**Como funciona:**
- Um card no Painel da Diretoria: "Atividade de grupos por unidade" — nº de mensagens,
  impedimentos abertos discutidos, fases concluídas no período, por unidade.
- Reusa as queries de chat já escopadas por `unitId`; para GLOBAL, agrega entre unidades
  (respeitando `security.md` §5 — a agregação é explícita e só para escopo GLOBAL).

**Valor de gestão:** a holding enxerga onde a colaboração está viva e onde está parada.

---

## Peça técnica comum a todas: "evento de sistema no grupo"

> **Decisão de produto (definida):** os avisos automáticos são **efêmeros**, entregues por
> **socket** (`group:system-event`) e renderizados como um banner no fio — **não** são
> persistidos como `Message`. Motivo: `Message.senderId` é obrigatório (FK para User) e o
> frontend não renderiza SYSTEM hoje; persistir exigiria migration + ajustes amplos em
> busca/bookmarks/render, com risco alto. A via efêmera tem **zero migration e zero risco de
> schema**, mantém o desacoplamento e entrega o valor de "a equipe vê o fato acontecer ao vivo".
> Se no futuro a persistência for desejada, evolui-se para um usuário "Sistema" reservado.

As integrações 1, 2 e 3 compartilham o mesmo mecanismo (emitir um evento de socket para a sala
do grupo). Vale implementá-lo **uma vez**:

### 1. Serviço de mensagem de sistema (no contexto chat)

```typescript
// apps/backend/src/contexts/chat/messages/system-message.service.ts  (novo)
@Injectable()
export class SystemMessageService {
  constructor(private prisma: PrismaService, private eventBus: EventBusService) {}

  /** Posts a non-user, SYSTEM message into a group and broadcasts it. */
  async post(groupId: string, unitId: string, content: string) {
    const message = await this.prisma.message.create({
      data: {
        groupId,
        senderId: SYSTEM_USER_ID,     // a reserved "Sistema" user, or null-sender handling
        content,
        type: MessageType.SYSTEM,
      },
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    })
    this.eventBus.publish(new MessageSentEvent(groupId, unitId, message))
    return message
  }
}
```

> **Decisão de design:** mensagens SYSTEM precisam de um "remetente". Duas opções: (a) um usuário
> reservado "Sistema" por unidade; (b) permitir `senderId` nulo e o frontend renderizar SYSTEM
> sem avatar. Recomendado: **(b)** — `MessageType.SYSTEM` já existe no enum e a UI pode renderizar
> um estilo próprio (centralizado, discreto), sem precisar de usuário fantasma. Ajustar o schema
> para `senderId` nullable **apenas** se SYSTEM for usado (migration pequena).

### 2. Handlers de domínio (no contexto chat, consumindo eventos de outros contextos)

Seguindo `architecture.md` §3 (consumir com `@OnEvent` **no contexto interessado**, nunca no emissor):

```typescript
// apps/backend/src/contexts/chat/handlers/strategy-to-chat.handler.ts  (novo)
@Injectable()
export class StrategyToChatHandler {
  constructor(private prisma: PrismaService, private system: SystemMessageService) {}

  @OnEvent('phase.completed')
  async onPhaseCompleted(e: PhaseCompletedEvent) {
    // Find groups linked to this objective/phase and post a system message.
    const groups = await this.prisma.group.findMany({
      where: { objectiveId: e.objectiveId, isArchived: false },
      select: { id: true, unitId: true },
    })
    for (const g of groups) {
      if (!g.unitId) continue
      await this.system.post(g.id, g.unitId, `🟢 Fase "${e.phaseName}" concluída.`)
    }
  }
  // ...idem para task.completed, impediment.escalated, meeting.scheduled
}
```

> **Fronteira de contexto:** este handler vive em `contexts/chat/` e **lê** o evento de
> `strategic`/`impediments` — não importa o service do outro contexto (apenas o **payload do
> evento**, que é o contrato estável — `architecture.md` §3). Mantém o desacoplamento.

### 3. Frontend — renderizar mensagem SYSTEM

`MessageBubble` ganha um ramo para `type === 'SYSTEM'`: linha centralizada, ícone, sem ações
de hover, sem avatar. Exemplo de estilo (tokens, `ui.md` §3):

```
        ──────  🟢 Fase "Diagnóstico" concluída  ──────
```

---

## Faseamento sugerido (cada fase entrega valor sozinha)

| Fase | Entrega | Eventos usados | Esforço |
|---|---|---|---|
| 22.1 | Mensagem de sistema (peça comum) + render SYSTEM no front | — | 4h |
| 22.2 | Integração 1 — feed do objetivo/projeto | `task.*`, `phase.*` | 5h |
| 22.3 | Integração 2 — impedimentos no grupo | `impediment.*` | 3h |
| 22.4 | Integração 3 — reuniões/ata no fio | `meeting.*`, `transcription.completed` | 3h |
| 22.5 | Integração 4 — hierarquia setor→subsetor (visual + parentId) | — | 3h |
| 22.6 | Integração 5 — card de atividade no Painel Diretoria | — | 4h |

---

## Regras `.claude` que este plano respeita

- **architecture.md §1** — chat não importa de `strategic`/`impediments`/`meetings`; só consome
  **eventos de domínio**. Os handlers de tradução evento→mensagem vivem em `contexts/chat/handlers/`.
- **architecture.md §3** — `@OnEvent` no contexto interessado (chat), payload como contrato.
- **architecture.md §7** — broadcast via EventBus → `realtime-event.handler.ts`, nunca socket direto no service.
- **security.md §5** — toda query nova escopada por `unitId`; a agregação GLOBAL (Integração 5) é explícita e só para escopo GLOBAL.
- **ui.md §3/§10** — render SYSTEM com tokens; realtime empurra para o cache, `socket.off` no cleanup.
- **architecture.md §10** — payloads/contratos em `@mediall/types`.

---

## Riscos e cuidados

- **Ruído no chat:** mensagens automáticas demais viram spam. Mitigar: postar só fatos
  relevantes (fase concluída, impedimento escalado), **não** cada microevento; e permitir ao
  admin do grupo **desligar** categorias de automação (toggle por grupo — reusa o painel do plano 21).
- **`senderId` de SYSTEM:** decidir nullable vs usuário reservado **antes** de implementar (afeta migration).
- **Loops de evento:** `SystemMessageService.post` publica `message.sent` — garantir que nenhum
  handler reaja a `message.sent` de tipo SYSTEM reentrando em automação (filtrar por `type`).
- **Performance:** handlers que fazem `findMany` de grupos por `objectiveId` precisam de índice
  em `Group.objectiveId` (adicionar `@@index([objectiveId])` — migration pequena).

---

## Arquivos criados/modificados (visão geral)

**Backend**
- `apps/backend/src/contexts/chat/messages/system-message.service.ts` — novo
- `apps/backend/src/contexts/chat/handlers/strategy-to-chat.handler.ts` — novo
- `apps/backend/src/contexts/chat/handlers/impediment-to-chat.handler.ts` — novo
- `apps/backend/src/contexts/chat/handlers/meeting-to-chat.handler.ts` — novo
- `apps/backend/src/contexts/chat/chat.module.ts` — registrar service + handlers
- `apps/backend/prisma/schema/chat.prisma` — `@@index([objectiveId])`; talvez `senderId` nullable (decisão 22.1)
- `packages/types/src/chat.ts` — contratos de payload se necessário

**Frontend**
- `apps/frontend/src/app/(auth)/mensagens/page.tsx` — render `MessageType.SYSTEM`; mini-progresso no header (22.2); agrupamento setor→subsetor na sidebar (22.5)
- `apps/frontend/src/features/chat/components/group-settings-modal.tsx` — toggles de automação por grupo (reusa plano 21)
- `apps/frontend/src/app/(auth)/dashboard/...` — card de atividade de grupos (22.6)

---

## Validação
- `npx tsc --noEmit` (backend + frontend) limpos.
- `npx prisma migrate dev --name chat_group_integrations` (índice + nullable se aplicável).
- Testar: concluir uma fase → mensagem aparece no grupo do objetivo; escalar impedimento →
  mensagem no grupo; desligar automação no painel → para de postar.
