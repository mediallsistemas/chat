# 25 — Painel "Jarvis": centro de comando visual da holding

> **⚠️ Antes de implementar este plano:** leia e siga **obrigatoriamente** as regras em
> [`.claude/rules/`](../../.claude/rules/) — em especial `architecture.md`, `security.md` e
> `ui.md`. Regras marcadas **🔴 OBRIGATÓRIO** são bloqueantes. Toda query respeita o isolamento
> por **tenant** e por **unit**. Se o código divergir da regra, **o código manda** — atualize a
> regra (ver `.claude/rules/README.md`).

**Prioridade:** 🟡 Alta — é a cara do produto (o que o cliente vê e demonstra para vender)
**Tempo estimado:** ~28–36h (faseável por bloco visual)
**Área:** Frontend (dashboard, header, navegação, drill-down), Backend (endpoints de agregação)
**Pré-requisito:** [24](24_plano_multiunidade.md) (plano multi-unidade) para o breakdown por unidade
fazer sentido. Funciona sem [23](23_multitenancy_saas.md), mas o ideal é depois dele (escopo tenant).

> **Decisão tomada (escopo desta rodada):** **Centro de comando visual** — seletor de unidade
> (inclusive para GLOBAL) + visão "todas as unidades" + drill-down + tempo real + alertas +
> **ações inline**. **Sem camada de IA nesta rodada** (a IA fica como evolução futura, ver fim
> do doc). Foco: enxergar tudo e agir, num lugar só.

---

## As dores que este plano cura (verificadas no código)

1. **GLOBAL não tem como navegar entre unidades.** O seletor de unidade no header só aparece para
   `AccessScope.MULTI` (`ui.md` §9). Um Admin/Diretoria GLOBAL cai numa unidade qualquer e o
   `/processos` ([processos-view.tsx:351-375](../../apps/frontend/src/app/(auth)/processos/processos-view.tsx))
   fica preso a essa unidade — sem trocar.
2. **Painel é global, telas são mono-unidade — não se conversam.** O card "Planos Estratégicos"
   do painel agrega tudo, mas "Ver todos →" leva ao `/processos` de **uma** unidade (por isso
   "mostra só 2 planos"). Falta a ponte: do consolidado para o detalhe e de volta.
3. **Painel mostra, mas não deixa agir.** É read-only. Falta ativar/arquivar/excluir plano,
   tratar impedimento, escalar — sem sair da visão geral.

---

## Visão do produto: 3 níveis de zoom

```
HOLDING  ─────────────  UNIDADE  ─────────────  PLANO/EXECUÇÃO
(todas as unidades)     (uma unidade)           (objetivo→meta→fase→board)

KPIs da holding         KPIs da unidade         árvore estratégica
grid de unidades  ──▶   planos da unidade  ──▶  kanban / tarefas
farol por unidade       impedimentos dela       impedimentos do plano
alertas agregados       ações da unidade        ações na execução
```

O usuário **navega o zoom** com um único controle no header e com cliques de drill-down. É o
"Jarvis": começa vendo a holding inteira e mergulha até a tarefa, sempre no mesmo fluxo.

---

## Peça 1 — Seletor de escopo no header (a chave que falta)

Hoje o seletor só existe para MULTI. Mudança:

- **GLOBAL e MULTI** passam a ter o seletor no header, com uma opção especial no topo:
  **"🏢 Toda a holding (todas as unidades)"** + a lista de unidades acessíveis.
- Selecionar "Toda a holding" → `unitStore.activeUnit = null` + um flag `scope: 'ALL'`. As telas
  consolidadas (painel) usam o modo agregado; as telas mono-unidade pedem para escolher uma.
- Selecionar uma unidade → comporta como hoje (contexto da unidade), mas **GLOBAL agora também
  consegue** trocar livremente.

```
┌──────────────────────────────────────────────┐
│  Acessando:  [ 🏢 Toda a holding        ▼ ]   │
│              ├ 🏢 Toda a holding (agregado)   │
│              ├ Mediall Brasil (Matriz)        │
│              ├ UEI                            │
│              ├ UPA Zona Sul                   │
│              └ …                              │
└──────────────────────────────────────────────┘
```

> **`ui.md` §9 a atualizar:** "seletor só para MULTI" passa a "seletor para MULTI **e GLOBAL**;
> GLOBAL ganha a opção agregada 'toda a holding'". O `unitStore` ganha `scope: 'ALL' | 'UNIT'`.

---

## Peça 2 — Painel da holding (o consolidado, turbinado)

Evolui o [dashboard/page.tsx](../../apps/frontend/src/app/(auth)/dashboard/page.tsx) (que já tem
KPIs + grid de unidades + impedimentos + planos + alertas, alimentado por `/dashboard/summary`):

- **Grid de unidades clicável → drill-down.** Cada card de unidade (já existe) vira link para a
  página de unidade ([dashboard/unidades/[unitId]/page.tsx](../../apps/frontend/src/app/(auth)/dashboard/unidades/) — já existe!).
- **Card "Planos da holding" com breakdown por unidade.** Em vez de listar planos soltos, mostra
  cada **plano compartilhado** (modelo do plano 24) com mini-barras por unidade atrelada:
  ```
  Gerência Médica 2026                          agregado 31% 🟡
    UPA Zona Sul ▓▓▓▓░░ 40%   HRGM ▓▓░░░░ 24%   HMMDO ▓▓░░░░ 28%
  ```
- **Filtros e busca:** por farol (só 🔴), por unidade, por tipo de unidade, busca por nome de
  plano/meta. Estado em memória (não é dado de domínio → pode ser `useState`/`uiStore`).
- **Tempo real (já existe):** `dashboard:update` via socket já invalida o summary
  ([use-dashboard.ts:67-78](../../apps/frontend/src/features/dashboard/hooks/use-dashboard.ts)).
  Estender o backend para emitir também em mudanças de plano/impedimento relevantes.

---

## Peça 3 — Página da unidade (o zoom intermediário)

A rota `/dashboard/unidades/[unitId]` já existe — enriquecer para ser o "cockpit da unidade":
- KPIs daquela unidade (planos ativos, impedimentos, tarefas atrasadas, metas em risco — as
  mesmas métricas do summary, filtradas).
- Lista dos planos atrelados à unidade (modelo do plano 24) → clique abre `/processos` já na
  unidade certa (resolve a desconexão painel↔processos).
- Impedimentos da unidade + atalho para tratar.
- Botão "Entrar no contexto desta unidade" → seta `unitStore.activeUnit` e leva ao `/processos`.

---

## Peça 4 — Ações inline (deixar de ser read-only)

O Jarvis "toma decisões": ações disponíveis direto da visão, com confirmação (`ui.md` §7):
- **Plano:** ativar / arquivar / excluir (de uma unidade ou geral — usa as rotas do plano 24).
- **Impedimento crítico:** marcar resolvido / escalar / abrir war-room (grupo) — reusa
  impedimentos + a integração de grupos (plano 22).
- **Meta em risco:** abrir a meta, reatribuir responsável.
- Toda ação = `Button` + `Modal`/`FormModal` de confirmação, `toast` de sucesso/erro
  (`ui.md` §7.3), invalida as query keys afetadas.

> Ações respeitam RBAC no backend (a UI só esconde o que o papel não pode — `security.md` §4,
> `ui.md` §9). Esconder botão **não** é segurança; o guard é a verdade.

---

## Backend — endpoints de agregação

O `/dashboard/summary` ([dashboard.service.ts](../../apps/backend/src/dashboard/dashboard.service.ts))
já agrega por escopo (GLOBAL vê tudo; MULTI/SINGLE filtra por `user.units`). Estender:

- `GET /dashboard/summary` — adicionar, em cada plano, o **breakdown por unidade**
  (`PlanUnit[]` do plano 24): `{ unitId, unitName, progress, trafficLight }`.
- `GET /dashboard/units/:unitId` — summary de **uma** unidade (cockpit da unidade), reaproveitando
  o cálculo do summary com `unitFilter` fixo naquela unidade.
- Manter o **cache de 30s** já existente (e por chave de escopo). Com tenant (plano 23), a chave
  de cache passa a incluir `tenantId`.

> Tudo continua escopado: GLOBAL agrega **dentro do tenant** (com o plano 23, a extension já
> garante que "tudo" = "tudo do meu tenant"). `security.md` §5 + a regra de tenant do plano 23.

---

## Faseamento (cada bloco entrega valor sozinho)

| Fase | Entrega | Esforço |
|---|---|---|
| 25.1 | Seletor de escopo no header p/ GLOBAL+MULTI + opção "toda a holding" + `unitStore.scope` | ~6h |
| 25.2 | Grid de unidades clicável → drill-down; ponte painel→/processos na unidade certa | ~4h |
| 25.3 | Card "planos da holding" com breakdown por unidade (depende do plano 24) | ~6h |
| 25.4 | Página cockpit da unidade (`/dashboard/unidades/[unitId]` enriquecida) + endpoint | ~7h |
| 25.5 | Ações inline (plano/impedimento/meta) com confirmação + RBAC | ~8h |
| 25.6 | Filtros/busca + realtime estendido (emitir em mudanças de plano/impedimento) | ~5h |

---

## Regras `.claude` que este plano respeita

- **ui.md §9** — atualizar: seletor de unidade para GLOBAL também + opção agregada. Permissão de
  UI nunca é segurança (ações validadas no backend).
- **ui.md §5/§6/§7** — TanStack Query com keys hierárquicas (+`tenantId`), skeletons por bloco,
  erro inline que não derruba a página, toasts em toda mutation.
- **ui.md §2/§3** — primitivos compartilhados (`Button`, `Modal`, `TrafficLight`, `ProgressBar`,
  `EmptyState`) e tokens (`gd/gm/gn/gs/gx`), sem hex cru.
- **architecture.md §5** — endpoints novos no padrão `{ data, ... }`, documentados no Swagger.
- **architecture.md §7** — realtime via EventBus → `realtime-event.handler.ts`, nunca socket no service.
- **security.md §5** — agregação GLOBAL é explícita e dentro do tenant.

---

## Riscos e cuidados

- **`activeUnit = null` (modo holding)** pode quebrar telas que assumem unidade. Mapear telas
  mono-unidade e exibir "selecione uma unidade" em vez de erro (já há esse padrão em
  `processos-view.tsx:369`).
- **Performance do breakdown por unidade** no summary: usar o cache `PlanUnit.progressPct` (plano
  24), não recalcular árvore. Manter o cache de 30s.
- **Realtime ruidoso:** debounce/coalescing de `dashboard:update` se muitas mudanças simultâneas.
- **Ações inline e RBAC:** testar que COLABORADOR/VISUALIZADOR não veem (nem conseguem) ativar/excluir.

---

## Validação

- `npx tsc --noEmit` frontend + backend.
- Como GLOBAL: trocar entre "toda a holding" e cada unidade pelo header; clicar uma unidade →
  cockpit → /processos já na unidade. "Ver todos os planos" mostra os planos compartilhados, não 2.
- Ações: ativar/arquivar/excluir plano (unidade e geral) com confirmação e toast; resolver
  impedimento atualiza o painel em tempo real.
- RBAC: VISUALIZADOR não vê ações de escrita.

---

## Evolução futura — a camada de IA (fora desta rodada)

Quando quiser ligar o "Jarvis que fala e decide" (você escolheu **não** agora), a base deste
plano já entrega os dados estruturados que a IA precisa. Caminho sugerido para depois:
- **Assistente em linguagem natural** (Claude via API — modelo `claude-opus-4-8` ou `claude-sonnet-4-6`):
  "Como está a UPA Zona Sul?" → resume KPIs + sugere prioridade. Os endpoints de summary/cockpit
  já são o "contexto" da IA.
- **Tool use:** dar à IA as mesmas ações inline (ativar plano, escalar impedimento) como
  *ferramentas*, executadas **sob confirmação** e registradas em `audit_log`.
- **Proativo:** job que pede à IA para varrer riscos ("meta X cairá para vermelho em 5 dias") e
  propor decisões. Tudo auditável.
- Marcar isso como um plano futuro (ex.: `27_jarvis_ia.md`) quando priorizado.
