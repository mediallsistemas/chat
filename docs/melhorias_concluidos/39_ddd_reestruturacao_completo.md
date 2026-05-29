---
name: ddd-reestruturacao-completo
description: Reestruturação DDD — monolito modular com 4 camadas por domínio completamente implementado (backend + frontend)
metadata:
  type: project
---

# Plano DDD — Reestruturação Monolito Modular: Concluído

## O que foi implementado

### Backend — Estrutura de pastas

```
apps/backend/src/
├── shared/               ← guards, decorators, interceptors, events, utils, filters, middleware
├── infrastructure/       ← prisma, gateway, mail, push, storage, jobs, health, notifications
└── contexts/             ← 15 domínios de negócio
    ├── auth, users, units, dashboard, reports, consents, audit, transcription
    └── chat, kanban, strategic, meetings, documents, tickets, impediments
```

### Cada domínio em `contexts/<domain>/` com DDD 4 camadas

```
contexts/<domain>/
├── domain/              ← eventos de domínio (DomainEvent subclasses)
├── application/         ← services (facade que os controllers chamam)
├── infrastructure/      ← implementações concretas (JWT strategy, etc.)
└── presentation/        ← controllers + DTOs de entrada
```

### Regras de dependência respeitadas
- `presentation` → `application` → `domain`
- Domínios não se importam diretamente — usam EventBus (`SharedModule` @Global)
- `infrastructure/` contém código técnico sem lógica de negócio

### Frontend — Feature folders

```
apps/frontend/src/
├── app/                 ← rotas Next.js (só pages + layouts)
├── features/            ← 14 domínios de negócio
│   ├── auth, units, users, strategic, kanban, chat, meetings
│   ├── impediments, documents, notifications, dashboard, tickets
│   ├── reports, audit, transcription
│   └── cada um com hooks/ e components/ próprios
└── shared/              ← ui/, layout/, hooks/, lib/, store/ cross-feature
```

### Migração notifications: infrastructure → contexts
- `infrastructure/notifications/` migrado para `contexts/notifications/` com estrutura DDD completa:
  - `application/services/notifications.service.ts`
  - `application/services/notification-settings.service.ts`
  - `presentation/controllers/notifications.controller.ts`
  - `presentation/controllers/notification-settings.controller.ts`
  - `presentation/dto/create-notification.dto.ts`
  - `presentation/dto/update-notification-settings.dto.ts`
  - `notifications.module.ts`
- Todos os 12 imports atualizados (app.module + 6 módulos + 6 services)

### EventBus
- `EventBusService` em `SharedModule` (@Global) disponível em todos os domínios
- `RealtimeEventHandler` em `infrastructure/gateway/` mapeia eventos de domínio → Socket.IO
- Nenhum domínio importa diretamente o service de outro domínio
