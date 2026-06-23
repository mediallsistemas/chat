# 21–22 — Índice: Evolução dos Grupos de Chat

> ✅ **Concluído (2026-06-21).** Plano **21** (gestão do próprio grupo) e plano **22**
> (integrações via EventBus) implementados. Resumo do 22: peça comum (system-event efêmero
> via socket `group:system-event` + render no fio) e Integração 2 (impedimentos) já existiam;
> esta entrega adicionou **Integração 1** (feed de tarefas/fases — `task.completed` no board do
> grupo e `phase.completed`/`phase.unlocked` nos grupos do objetivo, + mini-progresso do objetivo
> no header), **Integração 3** (reuniões: `meeting.scheduled`/`meeting.ended` → grupo via
> `Meeting.groupId`), **Integração 4** (hierarquia setor→subsetor: `parentId` na criação/edição +
> sidebar agrupada) e **Integração 5** (card "Atividade de Grupos por Unidade" no Painel da
> Diretoria). Decisão mantida: avisos automáticos **efêmeros** (sem persistir `Message`), sem
> migration. Handlers em `contexts/chat/handlers/` consomem só o payload dos eventos (sem cruzar
> contexto). Ver detalhes nos planos 21 e 22 nesta pasta.

> **⚠️ Antes de implementar estes planos:** leia e siga **obrigatoriamente** as regras em
> [`.claude/rules/`](../../../.claude/rules/) — em especial `architecture.md`, `security.md` e
> `ui.md`. Regras marcadas **🔴 OBRIGATÓRIO** são bloqueantes. Toda query respeita o isolamento
> por **tenant** e por **unit**. Se o código divergir da regra, **o código manda** — atualize a
> regra (ver `.claude/rules/README.md`).

Dois planos que evoluem os grupos de chat de "salas estáticas" para um espaço
**colaborativo e integrado à gestão**. Foram escritos a partir do código real
(não dos docs antigos de planejamento) e seguem as regras em [`.claude/rules/`](../../../.claude/rules/).

---

## Os dois planos

| Plano | Foco | Toca outras partes do sistema? | Esforço |
|---|---|---|---|
| [21 — Gestão do Próprio Grupo](21_gestao_do_grupo.md) | Capa, nome, descrição, permissões, papéis de admin, "só admins postam", VIEWER, painel de configurações | **Não** — só o grupo | ~10h |
| [22 — Grupos na Gestão do Sistema](22_grupos_na_gestao.md) | Grupo como "feed vivo": objetivos, impedimentos, reuniões, hierarquia setor→subsetor, visão da diretoria | **Sim** — via EventBus, sem acoplar contextos | ~18h (faseável) |

**Ordem recomendada:** fazer o **21 primeiro** (base de administração do grupo, reusada pelo 22
para os toggles de automação), depois o **22** em fases independentes.

---

## Por que esses planos (contexto)

Diagnóstico do estado atual (ver também [16_MELHORIAS_E_DIVIDA_TECNICA.md](../../16_MELHORIAS_E_DIVIDA_TECNICA.md)):

- Dos 6 `GroupType`, só **TEMPORARY** (auto-arquivamento) e **PRIVATE** (DM) têm comportamento
  real. `GENERAL/SECTOR/SUBSECTOR/PROJECT` são hoje **apenas rótulo/ícone**.
- Campos `avatarUrl`, `onlyAdminsPost`, `parentId`, `objectiveId` existem no schema mas estão
  **mortos** (salvos e nunca usados).
- Não há rota para **editar** um grupo depois de criado.

O plano **21** dá vida aos campos de administração do grupo. O plano **22** dá vida aos campos
de integração (`objectiveId`, `parentId`) usando os **eventos de domínio que o sistema já emite**
(`phase.completed`, `impediment.escalated`, `task.completed`, `meeting.scheduled`, …).

---

## Princípios comuns (das regras `.claude`)

- Regra de negócio no **Service**; controller só orquestra; controllers de unidade estendem `BaseUnitController`.
- Comunicação entre contextos **só por evento de domínio** — chat não importa `strategic`/`impediments`/`meetings`.
- Realtime via EventBus → `realtime-event.handler.ts`, nunca socket direto no service.
- Toda query escopada por `unitId`. Upload de capa reusa o fluxo MinIO existente (bucket privado, signed URL).
- UI nova em `src/features/chat/`, reusando primitivos (`FormModal`, `Input`, `Button`, `Avatar`),
  tokens de cor, `react-hook-form` + `zod` nos formulários.

---

## Conflitos de arquivo entre 21 e 22

| Arquivo | 21 | 22 | Ordem |
|---|---|---|---|
| `groups.service.ts` | `updateGroup`, `updateMemberRole` | (leitura de `objectiveId`/`parentId`) | 21 → 22 |
| `mensagens/page.tsx` | botão config, esconder input p/ VIEWER | render SYSTEM, mini-progresso, sidebar hierárquica | 21 → 22 |
| `group-settings-modal.tsx` | cria o modal | adiciona toggles de automação | 21 → 22 |
| `chat.prisma` | — (nenhum campo novo) | `@@index([objectiveId])`, talvez `senderId` nullable | só 22 gera migration |

**Fazer 21 antes de 22** evita retrabalho — o 22 estende a UI e o service criados no 21.
