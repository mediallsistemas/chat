# 19. Plano: Experiência do Colaborador

**Escopo:** dar ao role COLABORADOR (e VISUALIZADOR) uma UI minimalista e dedicada, sem acesso a planos gerais nem capacidade de criar entidades estruturais. Backend reforça a restrição via guards de role.

**Fora do escopo:** vínculo grupo↔objetivo, wiki/notas fixadas em grupo, grupos temporários auto-arquivados por evento. Esses pontos voltam num plano posterior (registrados em [docs/18_PLANO_CHAT_SLACK_LIKE.md](18_PLANO_CHAT_SLACK_LIKE.md) já cobre parte).

Referências:
- Sidebar atual: [apps/frontend/src/components/layout/sidebar.tsx](../apps/frontend/src/components/layout/sidebar.tsx)
- Roles: [packages/types/src/auth.ts](../packages/types/src/auth.ts)
- Guard stack: [apps/backend/src/shared/decorators/roles.decorator.ts](../apps/backend/src/shared/decorators/roles.decorator.ts) e `RolesGuard`

---

## Princípios

1. **Backend é fonte da verdade.** Esconder botão no front não é segurança — guard de role recusa a chamada.
2. **Menos é mais.** Sidebar do colaborador tem **2 itens**. Tudo o que ele faz cabe ali.
3. **Mobile-first pra `/meu`.** Colaborador opera em campo. Não pode depender de viewport grande.
4. **Sem rotas duplicadas.** Não criar `/minhas-tarefas`, `/meus-impedimentos`, etc. Tudo agregado em `/meu`.

---

## Decisões já tomadas

| Pergunta | Resposta |
|----------|----------|
| Quem é "padrão"? | **COLABORADOR** (existem outros roles que tratam diferente — esse plano cobre só esse caso). VISUALIZADOR herda mesma UI; diferença fica no backend (não pode escrever) |
| O que vê na sidebar? | **Minha visão + Mensagens** (só 2 itens) |
| O que pode criar? | **Nada fora do chat.** Read-only no resto. Pode mover tasks atribuídas a ele entre colunas e mandar DM 1-to-1 |
| Tasks: move livre ou só "feito"? | **Move livremente entre colunas.** Sem editar campos da task (título, descrição, responsável) |
| Impedimentos: vê todos do setor? | **Só onde é responsável** (mais restrito) |
| VISUALIZADOR tem `/meu`? | **Sim, mesma UI.** Backend recusa qualquer escrita |
| `/dashboard` adapta ao role? | **Não.** `/dashboard` continua sendo Painel da Diretoria. Rota nova `/meu` pro colaborador |

---

## Resumo das fases

| Fase | Esforço | Bloqueador? |
|------|---------|-------------|
| 1 — Backend guards de criação | 1.5d | Segurança — não pode esperar |
| 2 — Sidebar role-aware | 1d | Não |
| 4 — Limpar `/mensagens` pro colaborador | 0.5d | Não |
| 3 — Página `/meu` + endpoint agregado | 3-4d | Maior peça; vai por último |

**Total: ~6-7 dias-dev.** Ordem: 1 → 2 → 4 → 3.

---

## Fase 1 — Backend guards de criação (~1.5d)

### 1.1 Adicionar `@Roles()` aos endpoints de criação

Endpoints que devem ser whitelist `SUPER_ADMIN, DIRETORIA, GESTOR`:

| Endpoint | Localização |
|----------|-------------|
| `POST /units/:unitId/groups` | [groups.controller.ts](../apps/backend/src/contexts/chat/groups/groups.controller.ts) |
| `POST /units/:unitId/meetings` | [meetings.controller.ts](../apps/backend/src/contexts/meetings/meetings.controller.ts) |
| `POST /units/:unitId/kanban/.../tasks` | inspecionar `contexts/kanban` |
| `POST /units/:unitId/tickets` | inspecionar `contexts/tickets` |
| `POST /units/:unitId/impediments` | inspecionar `contexts/impediments` |
| `POST /units/:unitId/strategic/plans` (e similares) | inspecionar `contexts/strategic` |

Endpoints **livres** pra colaborador (não bloquear):
- `POST /units/:unitId/groups/direct` (DM 1-to-1)
- `POST /units/:unitId/groups/:id/messages` (mensagens)
- `POST /units/:unitId/groups/:id/messages/:mid/reactions`
- `POST /units/:unitId/chat/bookmarks`
- `PATCH /users/me/status`
- `POST /units/:unitId/chat/reminders` (lembretes pessoais)

### 1.2 Audit do PATCH de task

Colaborador deve mover **apenas** tasks onde `responsibleUserId === user.sub`. Se hoje o `PATCH` não checa isso, adicionar:

```ts
if (
  task.responsibleUserId !== user.sub &&
  ![SUPER_ADMIN, DIRETORIA, GESTOR].includes(user.role)
) {
  throw new ForbiddenException()
}
```

Permitir apenas mudança de **status**; rejeitar mudança de outros campos pra colaborador (whitelist no DTO ou check explícito no service).

---

## Fase 2 — Sidebar role-aware (~1d)

### 2.1 Reestruturar `navItems`

Em [sidebar.tsx](../apps/frontend/src/components/layout/sidebar.tsx), trocar o filtro atual (`roles: null` = todos) por um modelo mais expressivo:

```ts
const navItems = [
  // Colaborador / Visualizador
  { href: '/meu',       icon: 'ti-home',      label: 'Minha visão', roles: [COLABORADOR, VISUALIZADOR] },
  { href: '/mensagens', icon: 'ti-message-2', label: 'Mensagens',   roles: null },

  // Gestor +
  { href: '/dashboard',    icon: 'ti-layout-dashboard', label: 'Painel',       roles: [SUPER_ADMIN, DIRETORIA] },
  { href: '/processos',    icon: 'ti-sitemap',          label: 'Processos',    roles: [SUPER_ADMIN, DIRETORIA, GESTOR] },
  { href: '/kanban',       icon: 'ti-layout-kanban',    label: 'Kanban',       roles: [SUPER_ADMIN, DIRETORIA, GESTOR] },
  { href: '/impedimentos', icon: 'ti-alert-triangle',   label: 'Impedimentos', roles: [SUPER_ADMIN, DIRETORIA, GESTOR] },
  { href: '/reunioes',     icon: 'ti-video',            label: 'Reuniões',     roles: [SUPER_ADMIN, DIRETORIA, GESTOR] },
  { href: '/arquivos',     icon: 'ti-folder',           label: 'Arquivos',     roles: [SUPER_ADMIN, DIRETORIA, GESTOR] },
  { href: '/documentos',   icon: 'ti-file-text',        label: 'Documentos',   roles: [SUPER_ADMIN, DIRETORIA, GESTOR] },
  { href: '/chamados',     icon: 'ti-ticket',           label: 'Chamados',     roles: [SUPER_ADMIN, DIRETORIA, GESTOR] },

  // Admin
  { href: '/admin/usuarios',  icon: 'ti-users',       label: 'Usuários',  roles: [SUPER_ADMIN, DIRETORIA] },
  { href: '/admin/auditoria', icon: 'ti-list-search', label: 'Auditoria', roles: [SUPER_ADMIN, DIRETORIA] },

  // Configurações pessoais — todos
  { href: '/configuracoes/notificacoes', icon: 'ti-bell-cog', label: 'Notificações', roles: null },
]
```

Resultado: COLABORADOR vê `Minha visão`, `Mensagens`, `Notificações` (3 itens). Aceitável — notificações é configuração pessoal, faz sentido permanecer.

### 2.2 Garantir redirecionamento

Se colaborador acessar `/processos`, `/kanban`, etc. direto pela URL, redirecionar pra `/meu` no client-side. Implementação: `useRouter` + check de role em layout protegido (ou usar middleware Next).

---

## Fase 3 — Página `/meu` (~3-4d)

### 3.1 Endpoint agregado

`GET /units/:unitId/me/dashboard`

Reduz round-trips em mobile. Retorna:

```ts
{
  todayTasks: Task[],          // status != DONE, dueDate <= hoje, responsibleUserId === me
  myImpediments: Impediment[], // responsibleUserId === me, status BLOCKED | ATTENTION
  upcomingMeetings: Meeting[], // próximas 48h, sou participant
  unreadGroups: Array<{        // grupos onde lastReadAt < última mensagem
    group: Group,
    unreadCount: number,
    lastMessage: { content: string, senderName: string, createdAt: string },
  }>,
  weekTasks: Task[],           // 7d próximos
}
```

Implementação em novo módulo `contexts/me/` ou submódulo `users/me-dashboard/`. Decisão na execução.

### 3.2 Frontend `/meu/page.tsx`

Layout mobile-first em coluna única (max-width centralizado em desktop):

```
🏠 Olá, {nome}.
   {dia da semana, dd de mmm}

🔴 PRECISA DE VOCÊ HOJE
  • Task X · vence hoje    [→ modal status]
  • Impedimento Y           [→ detalhe read-only]

📅 PRÓXIMAS REUNIÕES
  • 14h · Reunião do setor [→ /reunioes/:id]

💬 CONVERSAS COM NOVIDADE
  • Equipe enfermagem (3)  [→ /mensagens?groupId=:id]
  • Maria (DM, 1)

📋 SUAS TAREFAS DA SEMANA
  [expansível]
```

### 3.3 Modal de task

Click numa task em qualquer card abre modal com:
- Título (read-only)
- Descrição (read-only)
- Status: **único campo editável** — dropdown ou drag handle
- Responsável (read-only, mostra o próprio user)
- Due date (read-only)
- Botão "Reportar bloqueio" → cria impedimento? (decisão depois; default: link pra mensagens da unidade)

### 3.4 Guard de rota

`/meu` só responde se role for COLABORADOR ou VISUALIZADOR. Outros roles redirecionados pra `/dashboard`.

---

## Fase 4 — Limpar `/mensagens` pro colaborador (~0.5d)

Em [mensagens/page.tsx](../apps/frontend/src/app/(auth)/mensagens/page.tsx):

- Esconder aba "Descobrir" (criada na Fase 4 do plano anterior) pro colaborador
- Esconder botão "+" (Novo grupo)
- Manter botão "Nova conversa direta" (DM 1-to-1 permanece liberada)
- Botão de admin de emojis em [/configuracoes/emojis](../apps/frontend/src/app/(auth)/configuracoes/emojis/page.tsx) já é condicional por role — OK

---

## O que NÃO vou fazer

| Item | Motivo |
|------|--------|
| Adaptar `/dashboard` ao role | Você quer UI dedicada, não híbrida — rota separada `/meu` |
| Criar `/minhas-tarefas`, `/meus-impedimentos`, etc | Tudo agregado em `/meu` evita proliferação de rotas |
| Permitir colaborador editar campos da task | Decisão: "apenas move as tasks" |
| Auto-filtro "minhas coisas" em `/kanban` | Colaborador nem vê `/kanban` na sidebar |
| Auto-criar impedimento ao mover task pra BLOCKED | Adiar pra plano de impedimentos — escopo grande |
| Notificar a cada task atrasada | Sistema de notificações já cobre |

---

## Decisões pendentes durante a execução

- Onde mora o endpoint `me/dashboard`? Novo `contexts/me/` ou submódulo em `users/`?
- Middleware Next vs check client-side pra redirecionar colaborador de `/processos` etc?
- Permissão de editar `pinnedNote` (deferido — sai do escopo dessa rodada)?
