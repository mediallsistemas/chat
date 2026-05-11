# Plano 14 — Roadmap e Fases
## Cronograma, sprints, entregas por fase

---

## Visão Geral

| Fase | Período | Foco | Planos |
|------|---------|------|--------|
| Fase 1 | Meses 1–2 | Base + Gestão Estratégica | 01, 02, 03, 04, 05, 10, 11, 12, 13 |
| Fase 2 | Meses 3–4 | Comunicação | 06, 07, 08 |
| Fase 3 | Meses 5–6 | Reuniões + Integração total | 09 |
| Fase 4 | Mês 7+ | Expansões | Mobile, IA, integrações |

---

## Fase 1 — Base + Gestão Estratégica (Meses 1–2)

**Prioridade máxima:** resolver a dor imediata da diretoria (visibilidade do plano estratégico).

### Sprint 1 (semanas 1–2) — Infraestrutura e Auth
- [ ] Provisionar servidor Ubuntu 24.04
- [ ] Docker Compose com todos os serviços
- [ ] Nginx + SSL
- [x] Setup Next.js + NestJS
- [x] Prisma schema completo
- [x] Autenticação JWT (login, logout, refresh)
- [x] Guard stack (JwtAuthGuard + RolesGuard + UnitScopeGuard)
- [x] Tabelas: users, units, user_units
- [x] CRUD básico de usuários e unidades

### Sprint 2 (semanas 3–4) — Gestão Estratégica
- [x] CRUD de planos estratégicos (criar + editar)
- [x] CRUD de objetivos (criar + editar)
- [x] CRUD de metas (OKRs) (criar + editar)
- [x] **Etapas (plan_phases)** com lógica de desbloqueio sequencial (criar + editar)
- [x] Cálculo de progresso bottom-up
- [x] Faróis automáticos

### Sprint 3 (semanas 5–6) — Kanban
- [x] Kanban boards, colunas e cartões
- [x] Drag-and-drop (react-beautiful-dnd, atualização otimista)
- [x] Aceite/recusa de tarefas
- [x] Prioridade e datas nas tarefas
- [x] Módulo backend MacroTask (auto-cria Kanban board por macro tarefa)
- [x] Página de detalhe de meta com Kanban da etapa ativa (`/processos/[planId]/[objectiveId]/[goalId]`)
- [x] Skeleton screens para Kanban e listas
- [x] Checklists em tarefas (backend CRUD + modal de detalhe no Kanban)
- [x] Dependências entre tarefas (Prisma TaskDependency, backend CRUD + ciclo/transitividade, UI no TaskDetailModal)
- [x] Visualizações: Lista e Calendário (toggle Board/Lista/Calendário no KanbanBoardClient)
- [x] Visualização: Timeline (Gantt)

### Sprint 4 (semanas 7–8) — Impedimentos + Painel
- [x] Módulo de impedimentos completo
- [x] Escalonamento automático (BullMQ + cron)
- [x] Painel da diretoria (GET /api/dashboard/summary + frontend conectado a dados reais)
- [x] Analytics de impedimentos (GET /api/units/:unitId/impediments/analytics + frontend)
- [x] Notificações básicas in-app (schema Notification, NotificationsModule, NotificationPanel, badge no header)
- [x] Multi-unidade: seletor no header (MULTI scope), store, use-units hook, invalidação de cache

---

## Fase 2 — Comunicação (Meses 3–4)

**Objetivo:** substituir WhatsApp e dispersão de mensagens.

### Sprint 5 (semanas 9–10) — Chat e Grupos
- [x] Socket.IO Gateway (JWT auth, join/leave rooms, typing, read)
- [x] CRUD de grupos (todos os tipos: GENERAL/SECTOR/PROJECT/TEMPORARY/PRIVATE)
- [x] Hierarquia de grupos (parentId no schema)
- [x] Chat em tempo real (Socket.IO message:new/edited/deleted)
- [x] Mensagens fixadas (pin/unpin), threads (replyToId), delete, edit
- [x] /mensagens page — sidebar de grupos + painel de chat completo
- [x] Reações emoji

### Sprint 6 (semanas 11–12) — Arquivos + Presença
- [x] Upload de arquivos (MinIO) — POST /units/:unitId/upload, FilesService, FileInterceptor
- [x] Preview inline — imagem inline, download de arquivos no MessageBubble
- [x] Status online / presença — gateway emite user:online/offline, GET /presence, usePresence hook + dot na sidebar
- [x] Indicador de digitação — message:typing socket, animated dots no chat
- [x] Conversas privadas 1:1 — POST /groups/direct, StartDirectModal no /mensagens
- [x] Arquivamento automático de grupos temporários — GroupArchiveJob cron 23:55 diário

### Sprint 7 (semanas 13–14) — Notificações
- [x] Push notifications (PWA)
- [x] Notificações por e-mail
- [x] Painel de notificações
- [x] Configurações por usuário
- [x] Modo não perturbe

### Sprint 8 (semanas 15–16) — Integração Chat ↔ Gestão
- [x] Vincular grupos a objetivos
- [x] Botão de contato rápido no painel
- [x] Menções de objetivos/tarefas no chat
- [x] Arquivos vinculados a tarefas

---

## Fase 3 — Reuniões + Integração Total (Meses 5–6)

### Sprint 9 (semanas 17–18) — Videochamadas
- [x] LiveKit Server configurado
- [x] Salas de reunião no frontend
- [x] Vídeo, áudio, compartilhamento de tela
- [x] Sala persistente por grupo
- [x] Sala temporária instantânea

### Sprint 10 (semanas 19–20) — Agendamento
- [x] CRUD de reuniões
- [x] Reuniões recorrentes (RRULE)
- [x] Agenda integrada
- [x] Lembretes automáticos
- [x] Gravação com consentimento

### Sprint 11 (semanas 21–22) — Analytics + Relatórios
- [x] Analytics de impedimentos completo
- [x] Exportação PDF/Excel
- [x] Relatório executivo automático
- [x] Auditoria e logs completos
- [x] Check-in periódico forçado de tarefas

### Sprint 12 (semanas 23–24) — Refinamento
- [x] Testes end-to-end
- [x] Performance e otimização
- [x] Documentação de API (Swagger)
- [ ] Treinamento dos usuários
- [x] Go-live completo

---

## Fase 4 — Expansões (Mês 7+)

Em ordem de prioridade sugerida:

- [x] PWA (Progressive Web App) — instalável no celular, baixo custo
- [ ] Aplicativo mobile React Native
- [x] Transcrição automática de reuniões (IA)
- [ ] Assinaturas digitais internas
- [x] Central de documentos institucionais
- [ ] Integrações hospitalares (TASY, MV, etc.)
- [x] Sistema de chamados interno
- [ ] PDI e gestão de performance de colaboradores

---

## Dependências Críticas

```
Infra + Auth  →  tudo depende disso
Modelo de dados completo  →  todos os módulos dependem
Multi-unidade  →  deve estar pronto na Fase 1
Etapas (plan_phases)  →  pode ser implementado junto com Fase 1
Chat  →  depende de Infra + Auth
Reuniões  →  depende de Chat (grupos) + Agenda
```

---

## Critérios de Go-live por Fase

### Fase 1 concluída quando:
- Diretoria consegue criar plano estratégico e ver progresso em tempo real
- Gestores conseguem criar e acompanhar tarefas no Kanban
- Impedimentos são registrados e escalonados automaticamente
- Isolamento por unidade funcionando corretamente

### Fase 2 concluída quando:
- WhatsApp pode ser substituído para comunicação interna
- Arquivos corporativos centralizados no sistema
- Notificações chegando pelos canais corretos

### Fase 3 concluída quando:
- Reuniões e videochamadas funcionando sem ferramentas externas
- Relatórios executivos sendo gerados automaticamente
- Sistema completo e auditável
