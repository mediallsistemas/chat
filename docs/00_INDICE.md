# Mediall Brasil — Plataforma Corporativa Interna
## Índice Geral de Planos de Implementação

> Baseado no Documento Técnico v1.0 (Maio 2026) e nas decisões de arquitetura definidas.

---

## Planos disponíveis

| # | Arquivo | Descrição | Prioridade |
|---|---------|-----------|------------|
| 01 | `01_INFRAESTRUTURA.md` | Servidor, Docker, Nginx, SSL, Banco de dados | 🔴 Fase 1 |
| 02 | `02_AUTENTICACAO_PERMISSOES.md` | JWT, Guards, RBAC, Multi-unidade, Holding | 🔴 Fase 1 |
| 03 | `03_GESTAO_ESTRATEGICA.md` | Planos, Objetivos, Metas, OKRs, Etapas, Kanban | 🔴 Fase 1 |
| 04 | `04_IMPEDIMENTOS.md` | Módulo de impedimentos e escalonamento automático | 🔴 Fase 1 |
| 05 | `05_PAINEL_DIRETORIA.md` | Dashboard consolidado, faróis, drill-down | 🔴 Fase 1 |
| 06 | `06_COMUNICACAO_CHAT.md` | Chat, grupos, hierarquia, WebSocket | 🟡 Fase 2 |
| 07 | `07_ARQUIVOS.md` | Upload, MinIO, versionamento, permissões | 🟡 Fase 2 |
| 08 | `08_NOTIFICACOES.md` | Sistema de notificações, push, e-mail | 🟡 Fase 2 |
| 09 | `09_REUNIOES_VIDEO.md` | Agendamento, LiveKit, WebRTC, agenda integrada | 🟢 Fase 3 |
| 10 | `10_MODELO_DADOS.md` | Todas as tabelas, relações e migrations Prisma | 🔴 Fase 1 |
| 11 | `11_FRONTEND_ARQUITETURA.md` | Next.js, estrutura de pastas, rotas, componentes | 🔴 Fase 1 |
| 12 | `12_BACKEND_ARQUITETURA.md` | NestJS, módulos, guards, interceptors, DTOs | 🔴 Fase 1 |
| 13 | `13_MULTI_UNIDADE_HOLDING.md` | Arquitetura multi-tenant, isolamento por unidade | 🔴 Fase 1 |
| 14 | `14_ROADMAP_FASES.md` | Cronograma, sprints, entregas por fase | 🔴 Geral |
| 15 | `15_UI_TEMPLATES.md` | Templates e padrões de UI | 🟡 Geral |
| 16 | `16_MELHORIAS_E_DIVIDA_TECNICA.md` | Diagnóstico completo + plano de ação por área | 🔴 Pós go-live |

---

## Convenções de Código

| Escopo | Convenção |
|--------|-----------|
| Funções e métodos (backend/frontend) | **Inglês** — ex: `createUser`, `findAllPlans`, `updateGoal` |
| Colunas e tabelas do banco de dados | **Inglês** — ex: `user_id`, `created_at`, `strategic_plans` |
| Nomes de variáveis e parâmetros | **Inglês** — ex: `unitId`, `payload`, `response` |
| DTOs e interfaces TypeScript | **Inglês** — ex: `CreatePlanDto`, `UserPayload` |
| Rotas de API REST | **Inglês** — ex: `/api/plans`, `/api/users/:id/goals` |
| Campos do Prisma schema | **Inglês** — ex: `createdAt`, `userId`, `isActive` |
| Comentários no código | **Inglês** |
| Mensagens de UI / textos exibidos ao usuário | **Português** |
| Nomes de arquivos e pastas (código) | **Inglês** — ex: `auth.service.ts`, `strategic-plan.controller.ts` |
| Documentação e planos (este repositório) | **Português** |

> Regra geral: **tudo que é código → inglês. Tudo que o usuário vê na tela → português.**

---

## Estrutura do Repositório (Monorepo)

```
mediall/                        ← repositório único
├── apps/
│   ├── backend/                ← NestJS (API + WebSocket)
│   │   ├── src/
│   │   ├── prisma/
│   │   └── package.json
│   └── frontend/               ← Next.js (App Router)
│       ├── src/
│       └── package.json
├── packages/
│   └── types/                  ← tipos TypeScript compartilhados
│       ├── src/
│       │   ├── auth.ts
│       │   ├── strategic.ts
│       │   ├── kanban.ts
│       │   └── index.ts
│       └── package.json
├── turbo.json                  ← orquestração de builds/dev
└── package.json                ← workspaces root (npm workspaces)
```

**Tooling:** [Turborepo](https://turbo.build) — paraleliza builds, compartilha cache.

| Comando (raiz) | O que faz |
|---------------|-----------|
| `npm run dev` | Inicia frontend + backend em paralelo |
| `npm run build` | Compila todos os apps em ordem correta |
| `npm run lint` | Lint em todos os apps |
| `turbo run dev --filter=backend` | Inicia só o backend |
| `turbo run dev --filter=frontend` | Inicia só o frontend |

**Regra:** tipos compartilhados (ex: `Plan`, `JwtPayload`, `KanbanTask`) vivem em `packages/types` e são importados nos dois apps. Nunca duplicar definições entre frontend e backend.

---

## Resumo da Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14+ / React 18+ / TypeScript / Tailwind CSS |
| Backend | NestJS 10+ / TypeScript |
| ORM | Prisma 5+ |
| Banco | PostgreSQL 16+ |
| Cache | Redis 7+ |
| Storage | MinIO |
| Video | LiveKit |
| Auth | JWT (HttpOnly Cookie) + Passport.js |
| HTTP Client | TanStack Query + Axios |
| Real-time | Socket.IO |
| Infra | Docker Compose + Nginx + Ubuntu Server 24.04 |

---

## Hierarquia do Sistema

```
Mediall Brasil (Matriz)
└── Unidades (UPA, UEI, Hospitais...)
    └── Áreas / Setores
        └── Subáreas
```

## Hierarquia de Gestão Estratégica

```
Plano → Objetivo → Meta (OKR) → Etapa → Tarefa Macro → Sub-tarefa (Kanban)
```

## Hierarquia de Acesso

```
GLOBAL      → Vê todas as unidades
MULTI       → Vê 2+ unidades específicas
SINGLE      → Vê apenas sua unidade
```
