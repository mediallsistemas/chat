# Plano 04 — Módulo de Impedimentos
## Escalonamento automático e analytics de bloqueios

---

## Objetivo
Implementar o sistema de impedimentos que transforma bloqueios individuais em dados estratégicos, garantindo que nenhum impedimento seja ignorado.

---

## Estados de Impedimento

| Estado | Cor | Comportamento |
|--------|-----|---------------|
| BLOCKED | 🔴 Vermelho | Tarefa completamente parada. Notificação imediata ao gestor. |
| ATTENTION | 🟡 Amarelo | Tarefa em risco. Visível no painel do gestor. Não bloqueia progresso. |
| RESOLVED | 🟢 Verde | Impedimento removido. Histórico registrado. |

---

## Fluxo de Registro

Ao marcar tarefa como BLOCKED, o responsável preenche:
- O que está impedindo (descrição obrigatória)
- Quem deve agir para resolver (responsável pela resolução)
- Data esperada de resolução

---

## Escalonamento Automático

```
Dia 0:   Tarefa marcada BLOCKED
          → Notificação ao responsável pelo bloqueio
          → Notificação ao gestor imediato

Dia 2*:  Sem resolução
          → Escalonamento automático para o gestor do setor

Dia 5*:  Ainda sem resolução
          → Escalonamento para a Diretoria
          → Resumo do histórico completo incluído

A qualquer momento:
          → Bloqueador marcado como RESOLVED
          → Escalonamento encerrado
          → Histórico registrado com quem resolveu e como
```

*Dias configuráveis pelo admin por unidade.

---

## Regras de Negócio

- Não é possível fechar um impedimento sem registrar como foi resolvido
- Impedimento RESOLVED registra: data, hora, quem desbloqueou, descrição da resolução
- Um impedimento ATTENTION não bloqueia o progresso da tarefa
- Um impedimento BLOCKED impede mover a tarefa para colunas posteriores no Kanban
- Histórico completo de impedimentos preservado mesmo após resolução

---

## Jobs Automáticos (node-cron + BullMQ)

```
Verificar impedimentos sem resolução → a cada hora
Escalonar impedimentos no prazo      → diariamente às 8h
Gerar relatório semanal de bloqueios → toda segunda às 7h
```

---

## Analytics de Impedimentos

Disponível no painel da diretoria:

- **Painel de gargalos:** todos os impedimentos ativos por setor, responsável e tempo em aberto
- **Impedimentos recorrentes:** mesmo tipo, mesmo setor, mesma causa raiz
- **Tempo médio de bloqueio por setor:** métrica estratégica
- **Ranking de resolução:** setores e pessoas que resolvem mais rápido vs mais lento
- **Exportação:** PDF/Excel para reuniões de governança

---

## Tabela: task_impediments

```
task_impediments
- id                          UUID PK
- task_id                     FK → tasks
- reported_by                 FK → users
- description                 text (o que está bloqueando)
- responsible_for_resolution  FK → users
- expected_resolution_date    date
- status                      ENUM (BLOCKED | ATTENTION | RESOLVED)
- resolved_by                 UUID nullable FK → users
- resolution_notes            text nullable
- escalation_level            integer (0=gestor, 1=diretoria)
- unit_id                     FK → units
- created_at                  timestamp
- updated_at                  timestamp
- resolved_at                 timestamp nullable
```

---

## Permissões

| Ação | Quem pode |
|------|-----------|
| Registrar impedimento | Responsável da tarefa, Gestor |
| Resolver impedimento | Responsável pela resolução, Gestor, SUPER_ADMIN |
| Ver impedimentos do setor | Gestor do setor |
| Ver todos os impedimentos | DIRETORIA, SUPER_ADMIN |
| Configurar prazos de escalonamento | SUPER_ADMIN |
| Ver analytics | DIRETORIA, SUPER_ADMIN |

---

## Checklist de Implementação

- [x] Tabela `task_impediments` no Prisma schema
- [x] Endpoint `POST /tasks/:id/impediments`
- [x] Endpoint `PATCH /impediments/:id/resolve`
- [x] Job de verificação diária de impedimentos sem resolução
- [x] Job de escalonamento automático (ImpedimentEscalationJob — 8h diário)
- [x] Notificação imediata ao registrar bloqueio — ImpedimentNotificationHandler.onCreated() via EventBus
- [x] Notificação de escalonamento com histórico — ImpedimentNotificationHandler.onEscalated() com daysOpen + description
- [x] Analytics no /impedimentos: tempo médio de resolução, breakdown por nível, top responsáveis (GET /analytics)
- [x] Painel de gargalos no dashboard da diretoria — lista dos críticos escalados na seção "Impedimentos Críticos"
- [x] Analytics: agrupamento por macro-tarefa (bySector) + recorrentes (recurring) — getAnalytics() expandido
- [x] Exportação PDF/Excel — useDownloadImpedimentsPdf e useDownloadImpedimentsExcel no frontend
- [x] Configuração de prazos de escalonamento por unidade — escalationDaysLevel1/2 na Unit, GET/PATCH /impediments/escalation-config
