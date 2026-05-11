# Plano 06 — Comunicação e Chat
## Grupos, hierarquia, WebSocket, tempo real

---

## Objetivo
Substituir WhatsApp e comunicação dispersa por um sistema de comunicação corporativa organizado, seguro e auditável.

---

## Tipos de Grupo

| Tipo | Regras |
|------|--------|
| GENERAL (Matriz) | Todos os colaboradores. Apenas usuários com permissão postam. Comunicados da diretoria. |
| SECTOR | Membros do setor. Qualquer membro pode postar. Tem Kanban próprio. |
| SUBSECTOR | Subconjunto de um grupo de área. Herda permissões do pai. |
| PROJECT | Criado para um objetivo estratégico. Reúne os envolvidos. |
| TEMPORARY | Com prazo de arquivamento obrigatório. Arquivado automaticamente. |
| PRIVATE | Chat 1:1. Não auditável por gestores. |

---

## Hierarquia de Grupos (espelha a org)

```
Grupo Geral (toda a holding)
└── Grupo Diretoria
└── Grupo por Área/Setor (ex: Gerência Médica)
    └── Subgrupo (ex: Enfermagem UPA)
    └── Subgrupo (ex: Enfermagem UEI)
└── Grupo de Projeto (vinculado a objetivo)
└── Grupo Temporário (com prazo)
```

---

## Isolamento por Unidade

- Um colaborador da UPA **não vê** grupos da UEI
- Grupos de área são específicos por unidade
- Grupos GENERAL existem por unidade E um global da holding
- DIRETORIA pode ver todos os grupos de todas as unidades

---

## Funcionalidades do Chat

- Mensagens em tempo real via WebSocket (Socket.IO)
- Texto, imagens, arquivos, links, menções (@nome), reações (emoji)
- Threads: resposta em fio sem poluir o canal
- Mensagens fixadas (pin) no topo do canal
- Busca por palavra-chave dentro dos grupos com acesso
- Status online: Disponível | Ausente | Não perturbe | Offline
- Indicador de digitação em tempo real
- Confirmação de leitura (visto por X membros)
- Encaminhar mensagem para outro grupo
- Editar e excluir mensagens (histórico de edições preservado para auditoria)

---

## Abas Internas de cada Grupo

Todo grupo (exceto PRIVATE) tem:

```
Chat | Kanban | Agenda | Arquivos | Membros | Configurações
```

---

## Grupos Temporários — Regras

- Data de arquivamento obrigatória ao criar
- 7 dias antes: notificação a todos os membros
- 1 dia antes: lembrete final
- No prazo, às 23:59: arquivamento automático
- Após arquivamento: somente leitura por 1 ano
- Admin pode prorrogar antes do prazo

---

## WebSocket — Eventos

```typescript
// Servidor emite:
'message:new'         // Nova mensagem no grupo
'message:edited'      // Mensagem editada
'message:deleted'     // Mensagem deletada
'user:typing'         // Usuário digitando
'user:online'         // Usuário ficou online
'user:offline'        // Usuário ficou offline
'group:archived'      // Grupo arquivado
'notification:new'    // Nova notificação

// Cliente emite:
'message:send'        // Enviar mensagem
'message:typing'      // Está digitando
'message:read'        // Marcar como lido
```

---

## Tabelas Principais

```
groups
- id, name, description, type, parent_id
- sector_id, objective_id, unit_id
- only_admins_post, is_archived, archive_at
- kanban_board_id

group_members
- group_id, user_id, role (ADMIN|MEMBER|VIEWER)
- joined_at, added_by

messages
- id, group_id, sender_id, content, type
- reply_to_id (threads), is_pinned
- is_edited, edited_at
- is_deleted, deleted_at
```

---

## Checklist de Implementação

- [x] Tabelas `groups`, `group_members`, `messages` no Prisma
- [x] Socket.IO server configurado no NestJS
- [x] Gateway de WebSocket com autenticação JWT
- [ ] Presença online via Redis (pub/sub) — feito com Map in-memory; Redis pub/sub não implementado
- [x] CRUD de grupos por tipo (GENERAL/SECTOR/SUBSECTOR/PROJECT/TEMPORARY/PRIVATE)
- [x] Hierarquia de grupos (parentId no schema + DTO)
- [x] Isolamento por unidade no filtro de grupos
- [x] Threads (replyToId — reply_to)
- [x] Mensagens fixadas (togglePin)
- [ ] Busca de mensagens por palavra-chave
- [x] Status online (user:online / user:offline via gateway)
- [x] Indicador de digitação (message:typing → user:typing broadcast)
- [ ] Confirmação de leitura com contagem de membros
- [x] Arquivamento automático de grupos temporários (GroupArchiveJob — cron 23:55)
- [x] Auditoria de edições e exclusões (AuditLogInterceptor global + isEdited/isDeleted em Message)
- [ ] Abas internas por grupo: Kanban, Agenda, Arquivos, Membros (página /mensagens/[groupId])
- [x] Conversas privadas 1:1 (POST /groups/direct + StartDirectModal no frontend)
- [x] Upload de arquivos no chat (paperclip button + preview inline + download)
- [ ] Reações emoji
