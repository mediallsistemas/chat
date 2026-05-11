# Plano 08 — Sistema de Notificações
## Push, e-mail, in-app, controle pelo usuário

---

## Objetivo
Sistema de notificações informativo sem ser invasivo, com controle total pelo usuário.

---

## Tabela de Eventos e Notificações

| Evento | Tipo |
|--------|------|
| Nova mensagem em grupo do qual é membro | Badge + push (se online: em tempo real) |
| Menção direta (@nome) | Notificação prioritária + som |
| Nova tarefa atribuída | Notificação + e-mail |
| Prazo de tarefa em 48h | Alerta no painel + e-mail |
| Tarefa vencida sem conclusão | Alerta vermelho + e-mail ao responsável e gestor |
| Impedimento registrado no setor | Notificação ao gestor |
| Escalonamento de impedimento | Notificação ao nível superior |
| Reunião em 24h / 15min | Lembrete automático |
| Meta com progresso abaixo do esperado | Alerta no painel da diretoria |
| Novo arquivo em tarefa observada | Notificação in-app |
| Delegação de tarefa (aceite/recusa) | Notificação bidirecional |
| Etapa concluída → próxima desbloqueada | Notificação aos responsáveis da nova etapa |
| Check-in periódico de tarefa | Notificação ao responsável |

---

## Canais

- **In-app:** badge no sino, painel de notificações
- **Push:** via service worker (PWA) ou APNs/FCM (mobile futuro)
- **E-mail:** para eventos críticos e lembretes

---

## Controle pelo Usuário

- Configurar quais notificações receber por canal
- Modo "Não perturbe" com horário configurável
- Silenciar grupos específicos

---

## Infraestrutura

- Redis pub/sub para distribuir notificações em tempo real
- BullMQ para filas de e-mail e notificações agendadas
- Tabela `notifications` para histórico in-app

---

## Checklist de Implementação

- [x] Tabela `notifications` no Prisma (modelo Notification + enum NotificationType)
- [x] Serviço de notificações no NestJS (NotificationsService: create, notifyMany, findAll, markRead, markAllRead)
- [x] Canal in-app via WebSocket (emite `notification:new` via AppGateway em cada create())
- [ ] Canal e-mail com template
- [ ] Fila BullMQ para notificações assíncronas
- [x] Painel de notificações no frontend (NotificationPanel + badge de não lidas no header)
- [ ] Configurações de notificação por usuário
- [ ] Modo não perturbe
- [ ] Silenciar grupos
