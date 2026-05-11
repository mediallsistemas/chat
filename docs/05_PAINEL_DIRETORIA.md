# Plano 05 — Painel da Diretoria
## Dashboard consolidado, faróis, drill-down

---

## Objetivo
Tela exclusiva para Diretoria e SUPER_ADMIN com visibilidade em tempo real de tudo que cada setor/unidade está executando.

---

## Acesso
Visível apenas para perfis: DIRETORIA e SUPER_ADMIN

---

## Seções do Painel

### 1. Visão Consolidada dos Planos
- Todos os planos ativos com % de progresso
- Farol por objetivo (🟢🟡🔴) em todos os setores e unidades
- Progresso calculado em tempo real

### 2. Resumo Operacional
- Total de tarefas: em andamento | concluídas | atrasadas | bloqueadas
- Comparativo entre unidades
- Tarefas vencidas sem conclusão destacadas em vermelho

### 3. Mapa de Impedimentos
- Impedimentos ativos por setor e unidade
- Tempo médio de bloqueio
- Setores com mais bloqueios
- Causa raiz recorrente

### 4. Visão por Unidade
- Cards por unidade com farol geral
- Clique na unidade → drill-down completo daquela unidade

### 5. Check-in Periódico
- Alertas de tarefas sem atualização há X dias
- Identifica "0% real" vs "0% por abandono"

---

## Drill-down

Clicar em qualquer objetivo navega para o detalhe do plano daquele objetivo. Clicar em qualquer unidade abre a visão completa daquela unidade. Clicar em qualquer impedimento abre o histórico completo.

---

## Botão de Contato Rápido

Em qualquer card de setor ou unidade, botão que abre diretamente o chat daquele grupo — sem sair do painel.

---

## Exportação

- Relatório completo em PDF ou Excel
- Filtros: por unidade, por objetivo, por período
- Formato executivo gerado automaticamente

---

## Alertas Proativos

| Evento | Alerta |
|--------|--------|
| Meta com progresso abaixo do esperado | 🔴 Alerta no painel |
| Objetivo sem atualização há 7 dias | 🟡 Alerta amarelo |
| Impedimento escalonado para diretoria | 🔴 Notificação prioritária |
| Etapa com prazo em 48h | 🟡 Alerta amarelo |
| Tarefa vencida sem conclusão | 🔴 Alerta vermelho |

---

## Multi-unidade no Painel

Para usuários GLOBAL: visão consolidada de todas as unidades com possibilidade de filtrar.

Para usuários MULTI: visão apenas das unidades que têm acesso, com seletor de contexto.

---

## Checklist de Implementação

- [x] Rota `/dashboard` (GET /api/dashboard/summary) com dados reais filtrados por escopo
- [x] Componente de visão consolidada de planos (frontend conectado à API)
- [ ] Faróis em tempo real via WebSocket
- [x] Cards de resumo operacional (métricas: planos, impedimentos, tarefas atrasadas, metas em risco)
- [x] Mapa de impedimentos (lista dos críticos escalados)
- [ ] Drill-down por objetivo
- [ ] Drill-down por unidade
- [ ] Botão de contato rápido (abre chat)
- [ ] Exportação PDF do relatório executivo
- [ ] Exportação Excel
- [x] Sistema de alertas proativos (seção de alertas dinâmica no frontend)
- [ ] Check-in periódico forçado com alertas
- [ ] Filtros por unidade e período
