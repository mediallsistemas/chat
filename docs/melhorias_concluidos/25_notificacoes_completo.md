---
name: notificacoes-completo
description: Módulo 08 — Notificações completamente implementado (push, email, in-app, mute de grupos, DND)
metadata:
  type: project
---

# Plano 08 — Notificações: Concluído

## O que foi implementado

### Backend
- `NotificationsService.create()` + `notifyMany()` — cria notificações in-app com respeito ao DND
- `GET/PATCH /notifications/settings` — configurações por usuário (DND, horários, email, push)
- `POST /notifications/settings/muted-groups/:groupId` + `DELETE` — silenciar/dessilenciar grupos individuais
- Modo não perturbe — `dndEnabled`, `dndStart`, `dndEnd` no schema, verificação em `NotificationsService`
- Fila BullMQ para envio de e-mail (`MailProcessor` via `mail` queue)
- Templates HTML de e-mail via Handlebars

### Frontend
- `NotificationPanel` — painel deslizável no header com lista de notificações
- Badge de não lidas no ícone do sino
- `/configuracoes/notificacoes` — página de configuração com DND e tipos de e-mail
- `useNotificationSettings` hook — GET/PATCH + mutedGroups, muteGroup, unmuteGroup
- Mute toggle no sidebar do chat: hover-reveal no `GroupItem`, ícone permanente nos silenciados

### Push Web
- `push.service.ts` — Web Push via `web-push` lib
- `POST /push/subscribe` + `DELETE /push/unsubscribe` — gerencia subscriptions
- `usePushSubscription` hook no frontend
