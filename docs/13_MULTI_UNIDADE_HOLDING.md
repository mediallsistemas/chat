# Plano 13 — Multi-unidade e Holding
## Arquitetura multi-tenant, isolamento por unidade

---

## Objetivo
Definir como a holding Mediall Brasil com múltiplas unidades é modelada, isolada e gerenciada no sistema.

---

## Estrutura da Holding

```
Mediall Brasil (Matriz)
├── Unidade: UPA Goiânia
├── Unidade: UEI Anápolis
├── Unidade: Hospital X
└── ...
```

Cada unidade tem:
- Gestão própria (equipe, setores, grupos)
- Planos estratégicos próprios
- Kanban e tarefas próprias
- Grupos de comunicação próprios
- Dados completamente isolados de outras unidades

A Matriz tem:
- Visão consolidada de todas as unidades
- Planos estratégicos globais (que podem ter etapas por unidade)
- Grupos de comunicação globais
- Painel executivo consolidado

---

## Escopos de Acesso

```
GLOBAL  → Vê e pode operar em todas as unidades
MULTI   → Vê e pode operar em unidades específicas autorizadas
SINGLE  → Vê e opera apenas na sua unidade
```

### Comportamento no Frontend por Escopo

**GLOBAL:**
- Painel mostra consolidado de todas as unidades
- Navegação livre entre unidades
- Sem seletor — acessa tudo

**MULTI:**
- Header mostra seletor: `"Acessando: [UPA Goiânia ▼]"`
- Ao trocar de unidade, contexto muda completamente
- Dados de uma unidade não aparecem na outra

**SINGLE:**
- Entra direto na unidade
- Sem seletor, sem ver outras unidades

---

## Roles por Contexto

Um mesmo usuário pode ter roles diferentes por unidade:

```
Dr. Gabriel
├── Acesso: MULTI
├── Role na UPA Goiânia:   GESTOR
└── Role na UEI Anápolis:  VISUALIZADOR

Diretora Ana
├── Acesso: GLOBAL
└── Role em todas:         DIRETORIA
```

---

## Isolamento de Dados

**Regra fundamental:** toda query que retorna dados deve filtrar por `unitId`.

```typescript
// ERRADO — retorna dados de todas as unidades
prisma.task.findMany()

// CERTO — filtrado pela unidade do usuário
prisma.task.findMany({
  where: { unitId: user.activeUnitId }
})
```

O `BaseUnitController` e o `UnitScopeGuard` garantem isso automaticamente. O `unitId` sempre vem da rota, nunca do body da requisição.

---

## Planos Estratégicos por Escopo

**Plano de unidade:** criado pela gestão local, visível apenas na unidade.

**Plano global (Matriz):** criado pela Diretoria, visível em todas as unidades. As etapas podem ser atribuídas a unidades específicas:

```
Etapa 1 (scope: ALL)       → todas as unidades executam em paralelo
Etapa 2 (scope: SPECIFIC)  → apenas UPA Goiânia executa
Etapa 3 (scope: MATRIX)    → executada centralmente pela Matriz
```

---

## Grupos de Comunicação por Escopo

**Grupos de unidade:** visíveis apenas pelos membros daquela unidade.

**Grupo geral da holding:** existe na Matriz, visível para todos os colaboradores de todas as unidades. Apenas DIRETORIA e admins postam.

**Grupo da diretoria:** restrito à alta liderança global.

---

## Onboarding de Nova Unidade

Ao criar uma nova unidade no sistema:

1. Admin cria a unidade (`POST /api/units`)
2. Sistema cria automaticamente:
   - Grupo geral da unidade
   - Kanban board padrão
   - Setores base (configuráveis)
3. Admin atribui o gestor da unidade
4. Gestor convida colaboradores
5. Colaboradores recebem e-mail de boas-vindas com link de acesso

---

## Tabelas Envolvidas

```
units              → hierarquia de unidades (matriz + filhas)
user_units         → relação N:N usuário ↔ unidade com role específico
groups (unitId)    → grupos isolados por unidade
tasks (unitId)     → tarefas isoladas por unidade
messages (via group.unitId)
strategic_plans (unitId)
meetings (unitId)
```

---

## Checklist de Implementação

- [x] Tabela `units` com hierarquia (parent_id)
- [x] Tabela `user_units` N:N com role por unidade
- [x] `accessScope` no payload do JWT
- [x] Array `units` (IDs) no payload do JWT
- [x] UnitScopeGuard validando acesso
- [x] Seletor de unidade no frontend (MULTI) — header.tsx com dropdown, useUnits hook, Zustand store
- [x] Store Zustand para unidade ativa (unit-store.ts com setUnits + switchUnit)
- [x] Todas as queries filtradas por unitId (via BaseUnitController + UnitScopeGuard)
- [x] Planos globais com etapas por escopo de unidade (UnitScope ALL/SPECIFIC/MATRIX + PhaseScopeBoard por unidade)
- [x] Grupo geral por unidade (incluindo Matriz) via seed + onboarding
- [x] Painel da diretoria com dados reais + drill-down por unidade
- [x] Fluxo de onboarding de nova unidade (`UnitsService.onboardUnit()` cria GENERAL group + Kanban base)
- [x] Drill-down por unidade no dashboard (`/dashboard/unidades/[unitId]`)
