# Plano de Correções de UX — Mediall Frontend

> Documento de planejamento das correções de UX/acessibilidade levantadas na auditoria de **2026-05-31**.
> Cada item traz: arquivo:linha de referência, descrição do problema e a correção proposta.
> Marque `[x]` conforme concluir.

---

## Resumo

A auditoria varreu todas as rotas autenticadas do frontend (`apps/frontend/src`). Foram encontrados problemas em quatro classes:

1. **Segurança/dados** — vazamento de token em log.
2. **Ações destrutivas sem confirmação** — clique único e irreversível.
3. **Falhas silenciosas** — mutations sem `onError`/toast.
4. **Acessibilidade e responsividade** — focus trap, mobile, teclado, `aria-*`.

Há também um problema **estrutural** de fundo: três árvores de componentes coexistindo (`components/`, `shared/components/`, `features/`) com cópias mortas e divergentes. Resolvê-lo elimina a raiz de várias inconsistências (dois `Modal`, dois `Button`, dois `use-toast`).

---

## Fase 0 — Estrutural — 🚧 PARCIAL (parte segura feita; merge dos UI kits adiado)

> Validada: frontend `tsc --noEmit` ok, `lint:boundaries` 0 erros, **`npm run build` ok** (24 rotas). Módulos caíram de 219 → 195.

**Diagnóstico real (corrige a premissa inicial):** não há uma árvore morta e outra viva. Existem **dois stacks paralelos, ambos vivos**: `@/shared/*` (usado pelo código em `features/*`) e `@/components/*`+`@/hooks/*`+`@/store/*`+`@/lib/*` (usado pelas páginas `app/*`). `features/kanban` e parte de `features/strategic` (painel, objective-detail) e `features/dashboard` (unit-detail) são rotas reais e vivas.

### Feito (seguro, validado com build)
- [x] **Remoção de código morto** — 22 módulos órfãos (0 dependentes, confirmados via `dependency-cruiser`) apagados: os duplicados `features/*/hooks/use-*` (audit, auth, dashboard, documents, impediments, meetings, notifications, reports, tickets, transcription) que tinham os mesmos query keys das versões vivas em `@/hooks/*`; o `src/hooks/use-kanban.ts` morto (vivo é `features/kanban/hooks/use-kanban`); `features/auth/*` inteiro (inactivity-guard, use-auth, use-inactivity-timeout, auth-store duplicado); `shared/components/layout/*`, `shared/components/pwa/*`, `shared/store/ui-store`, `shared/lib/{query-client,file-utils}`, `src/lib/file-utils`. Diretórios vazios removidos.
- [x] **Consolidação de singletons (corrige bug latente):** `@/shared/store/unit-store` → `@/store/unit-store` (eram dois `create()` Zustand com o mesmo key de persist `mediall-unit` → trocar a unidade no header **não** atualizava as páginas de `features/` até recarregar; agora há um store só). `@/shared/lib/api` → `@/lib/api` (o root é superior: refresh single-flight + guard de SSR).

### Adiado deliberadamente (muda comportamento — exige teste em runtime, idealmente com o app rodando)
- [ ] **Unificar os UI kits** `@/shared/components/ui` (≈19 importadores, em `features/*`) vs `@/components/ui` (≈25, em `app/*`). Os `Modal` **divergem** (o shared usa `createPortal` + footer + padding responsivo; o de components não). Mesclar muda renderização — precisa validar visualmente. Hoje o `ConfirmDialog` existe nos dois (criado na Fase 1).
- [ ] **Unificar `@/shared/components`** (PageHeader/MetricCard, ≈20) vs `@/components/shared` (≈9).
- [ ] **Unificar hooks divergentes** `@/hooks/use-strategic` (322 linhas) vs `@/features/strategic/hooks/use-strategic` (390 — tem `useStrategicPanel`/`usePlanUnit`/`usePhaseScopeProgress`) e `use-chat` (root) vs `features/chat/hooks/use-chat`. Mesmos query keys, implementações diferentes → merge cuidadoso.
- [ ] **`@/shared/hooks/use-toast`** (usado por código features) vs `@/hooks/use-toast` (o container montado). Já contornado nas fases anteriores importando sempre o de `@/hooks` onde o toast precisa aparecer.

> Recomendação: tratar o merge dos UI kits/hooks num PR dedicado, com o app rodando para checagem visual. O risco é regressão de renderização, sem ganho funcional.

---

## Fase 1 — Críticos (rápidos e de baixo risco) — ✅ CONCLUÍDA (100%)

> Validada: types build ok, backend `tsc --noEmit` ok, frontend `tsc --noEmit` ok, `lint:boundaries` 0 erros.

### 1.1 Vazamento de token no middleware — **segurança**
- **Arquivo:** `apps/frontend/src/middleware.ts:10`
- **Correção aplicada:** `console.log` com token/cookie removido.
- [x] Feito

### 1.2 Confirmação em ações destrutivas
Criado `ConfirmDialog` em ambas as árvores vivas (`components/ui/confirm-dialog.tsx` e `shared/components/ui/confirm-dialog.tsx`) e aplicado:
- [x] Deletar mensagem — `app/(auth)/mensagens/page.tsx`
- [x] Remover dos salvos — `app/(auth)/mensagens/salvos/page.tsx`
- [x] Sair do huddle — `app/(auth)/mensagens/huddle-mini.tsx`
- [x] Encerrar reunião (para todos) — `app/(auth)/reunioes/[meetingId]/page.tsx`
- [x] Concluir etapa (arquiva board, desbloqueia fase, notifica) — `processos/.../goal-detail-view.tsx`
- [x] Deletar pasta/documento — `app/(auth)/documentos/page.tsx`
- [x] Ativar/desativar usuário — `app/(admin)/admin/usuarios/page.tsx`
- [x] Remover anexo da tarefa (irreversível) — `features/kanban/components/task-detail-modal.tsx`
- [x] Substituir `confirm()` nativo por `ConfirmDialog` — `configuracoes/emojis/page.tsx` e `reunioes/page.tsx`

> **Decisão:** remover item de checklist e dependência da tarefa permanecem em **um clique** — são triviais de refazer; uma confirmação ali seria fricção desnecessária. Só o anexo de arquivo (irreversível) ganhou confirmação.

### 1.3 Falhas silenciosas no chat
- **Arquivo:** `apps/frontend/src/hooks/use-chat.ts`
- **Correção aplicada:** helper `onMutationError` + `onError` em todas as mutations (grupos, mensagens, reações, bookmark, emojis, lembretes, upload, direct, huddles).
- [x] Feito

### 1.4 Botão "Recusar" gravação não-funcional
- **Arquivos:** `video-room.tsx`, `use-meetings.ts`, backend `meetings.controller.ts` + `meetings.service.ts`, `packages/types/src/meetings.ts`
- **Correção aplicada:** backend agora rastreia recusas (`recordingDeclines`), aceita `{ consent: boolean }`, expõe `declinedCount` e bloqueia `allConsented` se houver recusa. Frontend liga "Recusar" → `submitConsent({ consent:false })`, e o dono passa a ver "X recusaram a gravação" em vez de contador travado.
- [x] Feito
- [ ] _Follow-up:_ reemitir o pedido de consentimento para participantes que entram durante gravação ativa (late joiner) — movido para a Fase 3.

### 1.5 Erros de exportação silenciosos
- **Arquivo:** `apps/frontend/src/hooks/use-reports.ts`
- **Correção aplicada:** `catch` com `toast.error(getErrorMessage(err))` nos 3 downloads.
- [x] Feito

### 1.6 Debounce de busca quebrado (admin usuários)
- **Arquivo:** `apps/frontend/src/app/(admin)/admin/usuarios/page.tsx`
- **Correção aplicada:** `searchTimerRef` agora usa `useRef`.
- [x] Feito

### 1.7 `/kanban` → board fixo inexistente + tela branca
- **Arquivos:** `app/(auth)/kanban/page.tsx`, `features/kanban/components/kanban-board-client.tsx`
- **Correção aplicada:** removido o redirect para `board-demo`; `/kanban` agora é uma landing que direciona para Processos/Mensagens. `kanban-board-client` mostra empty state "Board não encontrado" em vez de `null`.
- [x] Feito

### 1.8 Bug de fuso horário no calendário do Kanban
- **Arquivo:** `features/kanban/components/kanban-calendar-view.tsx`
- **Correção aplicada:** helper `toLocalKey` (componentes locais) usado na chave da célula, alinhando com o dia exibido.
- [x] Feito

### 1.9 Hook condicional no dashboard (Rules of Hooks)
- **Arquivo:** `app/(auth)/dashboard/page.tsx`
- **Correção aplicada:** `useDownloadDashboardPdf` movido para o topo, antes dos `return`.
- [x] Feito

---

## Fase 2 — Acessibilidade & Responsividade — ✅ CONCLUÍDA (resta só `role=menu`+setas, opcional)

> Validada: frontend `tsc --noEmit` ok, `lint:boundaries` 0 erros.

### 2.1 Focus trap nos modais
- **Correção aplicada:** novo hook `apps/frontend/src/hooks/use-focus-trap.ts` (loop Tab/Shift+Tab + restauração de foco ao fechar) aplicado em **ambas** as cópias de `Modal` (`components/ui` e `shared/components/ui`). Body scroll já era travado.
- [x] Feito

### 2.2 Sidebar responsiva
- **Correção aplicada:** rail de 52px agora é `hidden md:flex`; no mobile há um **drawer** (com labels + backdrop + botão fechar) controlado pelo `uiStore` (`sidebarOpen` agora default `false`), aberto por um botão hambúrguer adicionado ao `header.tsx` (`md:hidden`). Drawer fecha ao navegar e ao clicar no backdrop. `aria-current="page"` no item ativo.
- [x] Feito

### 2.3 Toasts acessíveis
- **Correção aplicada:** `toast-container.tsx` com `role="alert"`/`aria-live="assertive"` para erros e `status`/`polite` para o resto, mais botão de fechar; `use-toast.ts` ganhou `dismissToast` e duração por tipo (success 4s, warning 6s, error 8s).
- [x] Feito

### 2.4 Dropdowns do header
- **Correção aplicada:** um único efeito fecha unidade/notificações/usuário ao clicar fora **ou** pressionar Escape (antes só a unidade tinha clique-fora). Refs adicionados nos três containers.
- [ ] _Pendente (menor):_ `role="menu"`/`menuitem` + navegação por setas.

### 2.5 Cards e resultados navegáveis por teclado
- [x] Kanban card — já focável via atributos do dnd-kit; adicionado `aria-label` descritivo (título, prioridade, bloqueio, pendência). _Obs.: abrir via Enter conflitaria com o `KeyboardSensor` (Enter/Espaço iniciam o arraste); abertura por teclado exigiria handle de drag separado — deixado de fora._
- [x] Resultados de busca no chat — `role="button"`, `tabIndex`, `onKeyDown` (Enter/Espaço), `aria-label` e anel de foco — `search-panel.tsx`
- [ ] _Pendente:_ anunciar drag-and-drop (live region / instruções)

### 2.6 Login — ✅ feito
- **Arquivo:** `app/(public)/login/page.tsx`
- [x] Toggle mostrar/ocultar senha
- [x] `role="alert"`/`aria-live` na mensagem de erro
- [x] Feedback específico para conta bloqueada (423) e rate-limit (429)
- [x] Redirecionar usuário já autenticado para `/dashboard`

### 2.7 `FormField`/`Input` — associação de label — ✅ feito
- **Correção aplicada:** `Input`/`Select`/`Textarea` usam `useId()` como id estável (antes derivavam do label → colisão). `FormField` agora gera id, liga `label htmlFor` ao controle via `cloneElement`, e adiciona `aria-invalid`/`aria-describedby` apontando para a mensagem de erro.
- [x] Feito

---

## Fase 3 — Feedback, dados e estados — ✅ CONCLUÍDA

> Validada: frontend `tsc --noEmit` ok, backend `tsc --noEmit` ok, `lint:boundaries` 0 erros.

### 3.1 Autoscroll do chat sequestrando a rolagem
- **Correção aplicada:** rastreamento de "está no fim" (`atBottomRef` via `onScroll`, threshold 120px) em `mensagens/page.tsx` e `meeting-chat-panel.tsx`; só rola ao fim quando o usuário já está no fim. Carregar histórico antigo não mexe na rolagem.
- [x] Feito

### 3.2 Botões no-op no cabeçalho do chat
- **Correção aplicada:** botão de busca do cabeçalho ligado ao `setSearchOpen` (com estado ativo/`aria-pressed`); botão "Membros" removido (não havia painel — a contagem de membros já aparece no cabeçalho).
- [x] Feito

### 3.3 Troca de unidade global silenciosa
- **Correção aplicada:** `toast.warning` (via `@/hooks/use-toast`, o container realmente montado) ao trocar a unidade ativa no deep-link.
- [x] Feito

### 3.4 Paginação real onde há truncamento silencioso
- [x] Usuários — paginação **server-side** real (page/limit=20, prev/próxima) + filtro de role movido para o backend (`users.controller`/`users.service` aceitam `role` → `unitAccess.some.role`). `useUsers` ganhou `role` e `placeholderData`.
- [x] Reuniões passadas — botão "Ver mais (N)" com incremento de 10 — `reunioes/page.tsx`

### 3.5 Botão "Filtrar" enganoso (auditoria)
- **Correção aplicada:** botão removido; filtros aplicam no `onChange` e resetam a página para 1.
- [x] Feito

### 3.6 Feedback ao salvar notificações
- **Correção aplicada:** `toast.success` no sucesso e `onError`/toast no erro do `updateSettings` (no hook `use-notification-settings`).
- [x] Feito
- [ ] _Pendente (menor):_ guard de alterações não salvas ao sair da página.

### 3.7 Upload de arquivos (documentos e tarefas)
- [x] `accept` implícito + **validação de tamanho** no client (máx 25 MB) com aviso do limite — `documentos/page.tsx`
- [x] **Barra de progresso** (`onUploadProgress` no axios → `useUploadDocument`) — `documentos/page.tsx`
- [x] `onError`/toast em `use-task-files` (versão viva em `features/kanban/hooks`) + `try/catch` no `attachUpload`
- [ ] _Pendente:_ rollback/limpeza do blob órfão se o POST de metadados falhar (precisa de endpoint de delete-blob).

### 3.8 Double-submit nos status de chamados
- **Correção aplicada:** botões de status desabilitados com `updateTicket.isPending`.
- [x] Feito

### 3.9 Flicker de redirect no RoleGuard
- **Correção aplicada:** `RoleGuard` usa `useAuth()` e mostra um loader enquanto a identidade não é conhecida (`!user && isLoading`), evitando o flash de conteúdo restrito.
- [x] Feito

### 3.10 `processTranscript` sem tratamento de erro
- **Correção aplicada:** `onError`/toast + `toast.success` no `useProcessTranscript`.
- [x] Feito

### 3.11 Empty states ausentes
- [x] Detalhe de unidade sem planos/impedimentos — `dashboard/unidades/[unitId]/page.tsx`
- [x] Coluna vazia do Kanban (com CTA "adicionar") — `kanban-column.tsx`
- [x] Painel estratégico quando `data` é `undefined`/erro — `processos/painel/page.tsx`
- [x] Resposta de thread vazia — `mensagens/thread-panel.tsx`

---

## Fase 4 — Menores / polimento — ✅ CONCLUÍDA (quase: 2 itens adiados)

> Validada: frontend `tsc --noEmit` ok, `lint:boundaries` 0 erros.

- [x] Agenda: grid responsivo (`grid-cols-1 lg:grid-cols-[1fr_300px]`) e clique de objetivo agora abre `/processos/{planId}/{objectiveId}` — `reunioes/agenda/page.tsx`
- [x] "Meu perfil" renomeado para "Minha visão" (item aponta para `/meu`, que é a visão pessoal) — `header.tsx`
- [x] `PAGE_TITLES` completo (impedimentos, reuniões, documentos, chamados, configurações, painel, salvos, auditoria, meu) — `header.tsx`
- [x] Status emoji agora corta por code points (`Array.from(...).slice(0,2)`), `maxLength` 8 — `header.tsx`
- [x] Datas com ano em chamados — `chamados/page.tsx`
- [x] `daysOpen` usa `resolvedAt` quando resolvido ("Xd até resolver") — `impedimentos/page.tsx`
- [x] Heurística de dependência corrigida — usa `isDoneColumn` do board em vez do hack `!columnId` — `task-detail-modal.tsx`
- [x] Gantt: navegação de janela (± 30 dias + "Hoje") — `kanban-gantt-view.tsx`
- [x] Traffic-light fallback corrigido (`'GREEN'` em vez de `'green'`) + skeleton responsivo — `painel/page.tsx`
- [x] `error.tsx` mostra `error.digest` para o suporte — `(auth)/error.tsx`
- [x] Criados `global-error.tsx` e `not-found.tsx` em `src/app/` (PT-BR, com retry/voltar)
- [x] Banner PWA: dismiss persistido em `localStorage` e reposicionado (bottom-left, z-40) para não cobrir os toasts — `install-prompt.tsx`
- [x] Indicador de "digitando" pluraliza ("N pessoas estão digitando…") — `mensagens/page.tsx`
- [ ] _Adiado:_ WIP limit exibido mas não aplicado — `kanban-column.tsx`. Forçar o bloqueio de drop é decisão de produto; hoje é um indicador (badge vermelho) informativo.
- [ ] _Adiado:_ traffic-light com thresholds hardcoded no client (`processos-view.tsx`, `objective-detail-view.tsx`) — alinhar com o `trafficLight` do servidor exige decidir a fonte canônica.

---

## Ordem sugerida de execução

1. **Fase 1** (críticos) — maior impacto, baixo risco. Começar por 1.1 (log), 1.3 (chat), 1.5 (reports), 1.6 (debounce).
2. **Fase 0** (estrutural) — antes da Fase 2, para corrigir `Modal`/`Button`/`toast` uma única vez.
3. **Fase 2** (acessibilidade/responsividade).
4. **Fases 3 e 4** — feedback, dados e polimento.

## Critério de pronto

- Toda ação destrutiva exige confirmação.
- Toda mutation surfaceia erro via toast.
- Modais com focus trap; toasts com `aria-live`.
- Sidebar utilizável em mobile.
- `npm run lint` (frontend) sem erros novos.
