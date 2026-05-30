---
name: features-maio-2026
description: Todas as funcionalidades implementadas nas sessões de Maio 2026 (refresh token, dashboard drill-down, document versioning, chat search, read receipts, strategic user autocomplete, error boundaries)
metadata:
  type: project
---

# Features Implementadas — Maio 2026

> Sessões de implementação que cobriram múltiplos módulos. Cada item abaixo está em produção no código.

---

## Auth — Refresh Token via Redis

- `RefreshTokenService` — armazena SHA-256 hash do token no Redis com TTL de 7 dias (`contexts/auth/infrastructure/refresh-token.service.ts`)
- `POST /auth/refresh` — emite novo `auth_token` (15min) validando o refresh cookie
- `logout` revoga o refresh token no Redis e limpa ambos os cookies
- `InactivityGuard` no frontend — timeout de 30min, chama logout e redireciona para `/login`
- Interceptor Axios — silent refresh em 401: tenta `POST /auth/refresh` antes de redirecionar

## Auth — Audit Log de Login/Logout

- `prisma.auditLog.create({ action: 'LOGIN' })` após login bem-sucedido em `auth.service.ts`
- `prisma.auditLog.create({ action: 'LOGOUT' })` em logout
- Captura userId, IP (via `x-forwarded-for`), timestamp

## Auth — Bloqueio de Conta

- Já implementado: `failedLogins` incrementado a cada tentativa falha; `lockedAt` setado após 5 tentativas
- Desbloqueio manual via `PATCH /users/:id/unlock` (role SUPER_ADMIN)

---

## Dashboard — Drill-down e Filtros

- `GET /dashboard/summary?unitId=&from=&to=` — filtros por unidade e período
- `GET /dashboard/units/:unitId` — detalhe completo de uma unidade (planos, impedimentos, métricas)
- `/dashboard/unidades/[unitId]` — página de drill-down no frontend com `useDashboardUnit`
- Cards de unidade são links clicáveis para o drill-down

## Dashboard — Botão de Contato Rápido

- `generalGroupId` incluído na resposta do `/dashboard/summary` (query ao grupo GENERAL por unidade)
- Ícone de chat aparece no hover de cada card de unidade → link para `/mensagens?group=<generalGroupId>`

---

## Documentos — Busca e Versionamento

- `GET /units/:unitId/documents/search?name=&mime=&from=&to=` — busca full-text insensitive
- Versioning schema: campos `versionOf`, `versionNumber`, `isLatest` + migration `20260513000001`
- `POST /units/:unitId/documents/:id/versions` — sobe nova versão, marca anterior `isLatest: false`
- `GET /units/:unitId/documents/:id/versions` — lista histórico de versões

---

## Chat — Busca de Mensagens

- `GET /units/:unitId/groups/:groupId/messages/search?q=` — case-insensitive, retorna até 30 resultados
- `useMessageSearch(groupId)` hook no frontend
- UI: botão de lupa no header do chat abre barra de busca e exibe resultados em overlay

## Chat — Read Receipts

- `lastReadAt DateTime?` adicionado a `GroupMember` — migration `20260513000002`
- `POST /units/:unitId/groups/:groupId/read` — atualiza `lastReadAt`, conta membros que leram
- `AppGateway.emitToGroup(groupId, 'message:read:update', payload)` — broadcast em tempo real
- Frontend: ao trocar de grupo, chama `markRead()`. Header do chat exibe `X/Y leram`

## Chat — Reações Emoji

- `POST /messages/:messageId/reactions` com `{ emoji }` — toggle (adiciona/remove)
- Retorna contagens agrupadas + `myReactions[]` do usuário
- UI: `MessageBubble` mostra bolhas de reação clicáveis; QUICK_EMOJIS picker no hover

---

## Strategic — Seletor de Usuário Responsável (UserCombobox)

- `UserCombobox` component em `shared/components/ui/user-combobox.tsx` — dropdown pesquisável com avatar
- `useUnitMembers(unitId)` hook — consome `GET /units/:id/members`
- Aplicado em todos os modais que tinham campo UUID livre:
  - `create-objective-modal`, `edit-objective-modal`
  - `create-macro-task-modal`
  - `create-phase-modal`, `edit-phase-modal`
  - `create-task-modal` (kanban)

---

## UI — Error Boundaries

Adicionados `error.tsx` para todas as rotas de dados:
- `(auth)/impedimentos/error.tsx`
- `(auth)/dashboard/error.tsx`
- `(auth)/documentos/error.tsx`
- `(auth)/chamados/error.tsx`
- Já existiam: `kanban`, `processos`, `mensagens`, `reunioes`, `(auth)` raiz

---

## Sessão 2 — Impedimentos + Chat + Dashboard (13/05/2026)

### Impedimentos — Analytics expandido
- `getAnalytics()` retorna `bySector` (agrupado por macroTaskId) e `recurring` (tarefas com ≥2 impedimentos nos últimos 90d)
- Frontend: sidebar do `/impedimentos` exibe "Por setor" e "Recorrentes"

### Impedimentos — Configuração de escalonamento por unidade
- Campos `escalationDaysLevel1` (default 2) e `escalationDaysLevel2` (default 5) adicionados ao model `Unit`
- Migration `20260513000003_add_unit_escalation_thresholds`
- `escalatePending()` agora usa thresholds per-unit em vez de hardcoded
- GET/PATCH `/units/:unitId/impediments/escalation-config` — controla os dias por unidade
- UI: card "Escalonamento" na sidebar do `/impedimentos` com inputs inline

### Chat — Silenciar grupos
- Toggle de silêncio hover na `GroupItem` no sidebar do `/mensagens`
- Consome `mutedGroups`, `muteGroup`, `unmuteGroup` do `useNotificationSettings`
- Ícone `ti-bell-off` visível permanentemente nos grupos silenciados

### Chat — Painéis laterais Membros + Arquivos
- Botões no header do chat para alternar painéis direitos
- Membros: GET `/groups/:groupId/members` (via 2-query join User sem relação Prisma)
- Arquivos: GET `/groups/:groupId/files` (fileKey → signed URL via StorageService)
- `useGroupMembers` e `useGroupFiles` em `use-chat.ts`

### Dashboard — Tarefas sem atualização
- GET `/dashboard/stale-tasks` — tarefas sem `updatedAt` há 3+ dias, não bloqueadas, não concluídas
- `useStaleTaskAlerts()` hook no frontend
- Seção "Tarefas sem atualização" no `/dashboard` (aparece só quando há alertas, máx 20 linhas)

### Dashboard — Exportação Excel
- `exportDashboardExcel()` em `ReportsService` — 3 abas: Planos, Impedimentos, Tarefas Atrasadas
- GET `/units/:unitId/reports/dashboard/excel`
- `useDownloadDashboardExcel()` hook + botão "Excel" ao lado do PDF no header do dashboard

---

## Itens Ainda Pendentes

| Item | Doc | Prioridade |
|------|-----|-----------|
| Presença via Redis pub/sub | 06 | Médio |
| Notificação imediata ao registrar impedimento | 04 | Alto |
| Encriptação AES-256 para arquivos sensíveis | 07 | Baixo |
| Faróis em tempo real via WebSocket no dashboard | 05 | Baixo |
| Painel de gestão estratégica por unidade | 03 | Médio |
