# 21 — Gestão do Próprio Grupo (Colaborativo)

> ✅ **Concluído.** Implementado no back e no front: editar nome/descrição/capa, papéis de membro
> com guarda do último admin, `onlyAdminsPost` + `VIEWER` aplicados no envio, evento `group.updated`
> + bridge realtime, painel "Configurações do grupo" (abas Geral/Permissões/Membros) e ocultação do
> input para VIEWER/onlyAdminsPost.

> **⚠️ Antes de implementar este plano:** leia e siga **obrigatoriamente** as regras em
> [`.claude/rules/`](../../../.claude/rules/) — em especial `architecture.md`, `security.md` e
> `ui.md`. Regras marcadas **🔴 OBRIGATÓRIO** são bloqueantes. Toda query respeita o isolamento
> por **tenant** e por **unit**. Se o código divergir da regra, **o código manda** — atualize a
> regra (ver `.claude/rules/README.md`).
**Prioridade:** 🟢 Média — melhoria de produto
**Tempo estimado:** ~10h (backend 4h, frontend 6h)
**Área:** Chat / Grupos — gestão interna do grupo
**Escopo:** Apenas o próprio grupo. **Não** toca Kanban, estratégia, reuniões ou outras integrações (essas ficam no plano [22](22_grupos_na_gestao.md)).

---

## Objetivo

Hoje um grupo é praticamente imutável depois de criado: dá para arquivar, adicionar e
remover membros — e nada mais. Não há como **editar nome, descrição, trocar a capa,
ou de fato controlar quem fala**. Vários campos já existem no banco mas estão "mortos"
(salvos e nunca usados): `avatarUrl`, `onlyAdminsPost`, `visibility` pós-criação.

Este plano transforma o grupo em um espaço **colaborativo e administrável**, no espírito
do Slack/Discord, sem inventar complexidade: editar a "cara" do grupo, gerir papéis dos
membros e definir regras simples de participação.

### Resumo das funcionalidades

| Funcionalidade | Estado hoje | Depois |
|---|---|---|
| Editar nome e descrição | ❌ não existe | ✅ admin edita |
| Trocar capa do grupo (`avatarUrl`) | ❌ campo morto | ✅ upload de imagem (MinIO) |
| "Somente admins postam" (`onlyAdminsPost`) | ⚠️ salvo, nunca verificado | ✅ aplicado no envio |
| Promover/rebaixar admin | ⚠️ só via `addMember` (upsert) | ✅ ação dedicada e clara |
| Papel VIEWER (só leitura) | ⚠️ existe no enum, sem efeito | ✅ aplicado no envio |
| Mudar visibilidade pós-criação | ❌ não existe | ✅ admin alterna público/convite |
| Painel "Configurações do grupo" | ❌ não existe | ✅ modal/aba dedicada |
| Atualização em tempo real do grupo | ❌ não existe | ✅ evento `group:updated` |

---

## Estado atual (verificado no código)

- `Group` já tem todos os campos necessários: `name`, `description`, `avatarUrl`,
  `onlyAdminsPost`, `visibility` — ver [chat.prisma](../../../apps/backend/prisma/schema/chat.prisma) (model `Group`, linhas 4-30).
- `GroupMember.role` é o enum `GroupMemberRole = ADMIN | MEMBER | VIEWER` — VIEWER não tem efeito hoje.
- Service [groups.service.ts](../../../apps/backend/src/contexts/chat/groups/groups.service.ts) tem `create`, `archive`, `addMember`, `removeMember`, `findOrCreateDirect` — **não há `update`**.
- `messages.service.ts` `send()` **não verifica** `onlyAdminsPost` nem o papel do membro.
- O gateway só emite eventos de mensagem/huddle para a sala `group:<id>` — **nenhum evento de grupo** (mudança de nome/capa não chega aos outros membros em tempo real).
- Upload de imagem já existe: `POST /units/:unitId/upload` → MinIO, chave `${unitId}/${uuid}` + signed URL (reusar — `security.md` §7).

---

## Regras `.claude` que este plano respeita

- **architecture.md §2** — regra de negócio no Service; controller só orquestra; controllers de unidade estendem `BaseUnitController`.
- **architecture.md §6** — todo DTO com `class-validator`.
- **architecture.md §7 / ui.md §10** — service não emite no socket direto; publica **evento de domínio** e o `realtime-event.handler.ts` faz a ponte.
- **architecture.md §10** — tipos compartilhados em `@mediall/types`, sem duplicar.
- **security.md §7** — upload de capa reusa o fluxo existente (chave por unidade, signed URL, limite 20MB). Validar MIME de imagem.
- **security.md §5** — toda query escopada por `unitId` (via relação `group: { unitId }`).
- **ui.md §1/§2/§3** — UI nova em `src/features/chat/components/` com barrel; reusar primitivos (`FormModal`, `Input`, `Textarea`, `Button`, `Avatar`); tokens de cor, sem hex cru.
- **ui.md §4** — formulários com `react-hook-form` + `zod`.

---

## Backend

### 1. DTOs — editar grupo e papel de membro

```typescript
// apps/backend/src/contexts/chat/groups/dto/update-group.dto.ts  (novo)
import { IsString, IsOptional, IsBoolean, IsEnum, MaxLength } from 'class-validator'
import { GroupVisibility } from '@mediall/types'

export class UpdateGroupDto {
  @IsOptional() @IsString() @MaxLength(80)
  name?: string

  @IsOptional() @IsString() @MaxLength(500)
  description?: string

  /** MinIO key returned by POST /upload; service resolves it to avatarUrl. */
  @IsOptional() @IsString()
  avatarKey?: string

  @IsOptional() @IsBoolean()
  onlyAdminsPost?: boolean

  @IsOptional() @IsEnum(GroupVisibility)
  visibility?: GroupVisibility
}
```

```typescript
// apps/backend/src/contexts/chat/groups/dto/update-member-role.dto.ts  (novo)
import { IsEnum } from 'class-validator'
import { GroupMemberRole } from '@mediall/types'

export class UpdateMemberRoleDto {
  @IsEnum(GroupMemberRole)
  role: GroupMemberRole
}
```

### 2. Service — `updateGroup`, `updateMemberRole`, guarda "último admin"

```typescript
// apps/backend/src/contexts/chat/groups/groups.service.ts  (adicionar)

private async assertAdmin(unitId: string, groupId: string, userId: string) {
  const member = await this.prisma.groupMember.findFirst({
    where: { groupId, userId, group: { unitId } },
    select: { role: true },
  })
  if (!member || member.role !== 'ADMIN') {
    throw new ForbiddenException('Somente administradores do grupo podem fazer isso.')
  }
}

async updateGroup(unitId: string, groupId: string, dto: UpdateGroupDto, user: JwtPayload) {
  await this.assertAdmin(unitId, groupId, user.sub)

  // Resolve cover image: avatarKey (MinIO) → public-ish signed URL stored on the group.
  // Reuses the existing upload flow; we only persist the key-derived URL.
  const avatarUrl = dto.avatarKey
    ? await this.filesService.getSignedUrl(dto.avatarKey)
    : undefined

  const group = await this.prisma.group.update({
    where: { id: groupId },
    data: {
      name: dto.name,
      description: dto.description,
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      onlyAdminsPost: dto.onlyAdminsPost,
      visibility: dto.visibility,
    },
  })

  // Realtime: notify members the group changed (architecture.md §7).
  this.eventBus.publish(new GroupUpdatedEvent(groupId, unitId, group))
  return group
}

async updateMemberRole(
  unitId: string, groupId: string, targetUserId: string,
  dto: UpdateMemberRoleDto, user: JwtPayload,
) {
  await this.assertAdmin(unitId, groupId, user.sub)

  // Never allow removing the last admin (lock-out protection).
  if (dto.role !== 'ADMIN') {
    const admins = await this.prisma.groupMember.count({
      where: { groupId, role: 'ADMIN', group: { unitId } },
    })
    const target = await this.prisma.groupMember.findFirst({
      where: { groupId, userId: targetUserId },
      select: { role: true },
    })
    if (target?.role === 'ADMIN' && admins <= 1) {
      throw new ForbiddenException('O grupo precisa de ao menos um administrador.')
    }
  }

  const member = await this.prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId: targetUserId } },
    data: { role: dto.role },
  })
  this.eventBus.publish(new GroupUpdatedEvent(groupId, unitId, { id: groupId }))
  return member
}
```

> **Nota sobre a capa (cover):** o signed URL do MinIO expira em 1h. Para a capa do grupo
> (exibida sempre), o ideal é **persistir a `key`** e resolver o signed URL na leitura
> (`findAll`/`findOne`), como já é feito para anexos de mensagem em `attachFileUrl`. Decisão
> de implementação: armazenar `avatarUrl = key` e resolver na leitura, **ou** tornar o bucket
> de capas de leitura pública. Recomendado: resolver na leitura, mantendo o bucket privado
> (consistente com `security.md` §7). Ajustar `findAll`/`findOne` para fazer `getSignedUrl(avatarUrl)`
> quando `avatarUrl` for uma key.

### 3. Aplicar `onlyAdminsPost` e VIEWER no envio de mensagens

```typescript
// apps/backend/src/contexts/chat/messages/messages.service.ts  → send()
// Após assertMembership, antes de criar a mensagem:

const member = await this.prisma.groupMember.findFirst({
  where: { groupId, userId: user.sub, group: { unitId } },
  select: { role: true, group: { select: { onlyAdminsPost: true } } },
})
if (!member) throw new ForbiddenException('Você não é membro deste grupo.')
if (member.role === 'VIEWER') {
  throw new ForbiddenException('Você tem acesso somente leitura neste grupo.')
}
if (member.group.onlyAdminsPost && member.role !== 'ADMIN') {
  throw new ForbiddenException('Somente administradores podem postar neste grupo.')
}
```

> Isso transforma `onlyAdminsPost` e o papel `VIEWER` em regras **reais**, fechando a lacuna
> apontada no diagnóstico. A UI também deve esconder a caixa de envio nesses casos (defesa em
> profundidade — `ui.md` §8), mas o backend é a fonte da verdade.

### 4. Evento de domínio + ponte realtime

```typescript
// apps/backend/src/contexts/chat/groups/events/group-updated.event.ts  (novo)
import { DomainEvent } from '../../../../shared/events/domain-event.base'

export class GroupUpdatedEvent extends DomainEvent {
  readonly eventName = 'group.updated'
  constructor(
    public readonly groupId: string,
    public readonly unitId: string,
    public readonly payload: unknown,
  ) { super() }
}
```

```typescript
// apps/backend/src/infrastructure/gateway/realtime-event.handler.ts  (adicionar)
@OnEvent('group.updated')
onGroupUpdated(event: GroupUpdatedEvent) {
  this.gateway.emitToGroup(event.groupId, 'group:updated', event.payload)
}
```

### 5. Controller — novas rotas

```typescript
// apps/backend/src/contexts/chat/groups/groups.controller.ts  (adicionar)

@Patch('groups/:groupId')
update(
  @Param('unitId') unitId: string,
  @Param('groupId') groupId: string,
  @Body() dto: UpdateGroupDto,
  @CurrentUser() user: JwtPayload,
) {
  return this.groupsService.updateGroup(unitId, groupId, dto, user)
}

@Patch('groups/:groupId/members/:userId/role')
updateMemberRole(
  @Param('unitId') unitId: string,
  @Param('groupId') groupId: string,
  @Param('userId') targetUserId: string,
  @Body() dto: UpdateMemberRoleDto,
  @CurrentUser() user: JwtPayload,
) {
  return this.groupsService.updateMemberRole(unitId, groupId, targetUserId, dto, user)
}
```

> **Autorização:** as novas rotas **não** levam `@Roles(...)` de papel de sistema — a permissão
> aqui é o papel **dentro do grupo** (ADMIN do grupo), validado em `assertAdmin`. Isso é
> intencional: um GESTOR não-admin do grupo não deve poder editá-lo, mas o criador (admin do
> grupo) sim. Documentar essa decisão no PR.

### 6. Tipos compartilhados

```typescript
// packages/types/src/chat.ts  → enum já existe (GroupMemberRole). Adicionar contrato:
export interface UpdateGroupInput {
  name?: string
  description?: string
  avatarKey?: string
  onlyAdminsPost?: boolean
  visibility?: GroupVisibility
}
```

---

## Frontend

### 7. Hooks — `useUpdateGroup`, `useUpdateMemberRole`

```typescript
// apps/frontend/src/features/chat/hooks/use-chat.ts  (adicionar)

export function useUpdateGroup(groupId: string) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateGroupInput) =>
      api.patch(getUrl(activeUnit!.id, `/groups/${groupId}`), dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', activeUnit?.id] })
      toast.success('Grupo atualizado.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useUpdateMemberRole(groupId: string) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: GroupMemberRole }) =>
      api.patch(getUrl(activeUnit!.id, `/groups/${groupId}/members/${userId}/role`), { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', activeUnit?.id] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
```

### 8. Realtime — escutar `group:updated`

No `useMessages` (ou num `useGroupRealtime` dedicado), registrar o listener e invalidar
a lista de grupos para refletir nome/capa/regras novas em todos os membros:

```typescript
socket.on('group:updated', () => qc.invalidateQueries({ queryKey: ['groups', activeUnit?.id] }))
// lembrar do socket.off no cleanup (ui.md §10)
```

### 9. UI — painel "Configurações do grupo"

Novo componente em `src/features/chat/components/group-settings-modal.tsx` (+ `index.ts` barrel).
Aberto por um botão de engrenagem no cabeçalho da conversa (`page.tsx`), visível só para admin
do grupo. Usa `FormModal` + `react-hook-form` + `zod` (`ui.md` §4).

Conteúdo (abas ou seções):

- **Geral**
  - Capa: `Avatar` grande + botão "Trocar capa" → reusa `useUploadFile` → manda `avatarKey` no update.
  - Nome (`Input`), Descrição (`Textarea`).
- **Permissões**
  - Toggle "Somente administradores podem postar" (`onlyAdminsPost`).
  - Toggle "Grupo público na unidade" (`visibility` UNIT_PUBLIC ↔ PRIVATE_INVITE).
- **Membros**
  - Lista de membros com `Avatar` + nome + seletor de papel (Admin / Membro / Somente leitura)
    → `useUpdateMemberRole`. Botão remover (já existe `removeMember`).
  - Badge "Você" no próprio usuário; bloquear rebaixar o último admin (espelha o backend).

```
┌─ Configurações do grupo ───────────────────────┐
│ [Geral] [Permissões] [Membros]                  │
│                                                 │
│  ╭───╮  Capa do grupo                           │
│  │ 🖼 │  [ Trocar capa ]                         │
│  ╰───╯                                          │
│  Nome        [ Comunicação Interna           ]  │
│  Descrição   [ Avisos gerais da unidade…     ]  │
│                                                 │
│            [ Cancelar ]   [ Salvar ]            │
└─────────────────────────────────────────────────┘
```

### 10. Esconder caixa de envio para VIEWER / onlyAdminsPost

Em `page.tsx`, quando o membro atual é `VIEWER`, ou o grupo é `onlyAdminsPost` e o usuário
não é admin do grupo, substituir a barra de input por um aviso:
"Somente administradores podem enviar mensagens neste grupo." (defesa em profundidade; backend já barra).

> Requer expor o **papel do usuário atual no grupo** no payload de `findAll`/`findOne`.
> Hoje `findAll` já traz `members: { where: { userId }, select: { role: true } }` — usar esse `role`.

---

## Tabela de rotas novas

| Método | Rota | Quem pode | Efeito |
|---|---|---|---|
| `PATCH` | `/units/:unitId/groups/:groupId` | Admin do grupo | Edita nome, descrição, capa, regras, visibilidade |
| `PATCH` | `/units/:unitId/groups/:groupId/members/:userId/role` | Admin do grupo | Promove/rebaixa papel (com guarda do último admin) |

---

## Arquivos criados/modificados

**Backend**
- `apps/backend/src/contexts/chat/groups/dto/update-group.dto.ts` — novo
- `apps/backend/src/contexts/chat/groups/dto/update-member-role.dto.ts` — novo
- `apps/backend/src/contexts/chat/groups/events/group-updated.event.ts` — novo
- `apps/backend/src/contexts/chat/groups/groups.service.ts` — `updateGroup`, `updateMemberRole`, `assertAdmin`; resolver capa na leitura
- `apps/backend/src/contexts/chat/groups/groups.controller.ts` — 2 rotas novas
- `apps/backend/src/contexts/chat/messages/messages.service.ts` — checar VIEWER + `onlyAdminsPost` no `send`
- `apps/backend/src/infrastructure/gateway/realtime-event.handler.ts` — bridge `group.updated`
- `packages/types/src/chat.ts` — `UpdateGroupInput`

**Frontend**
- `apps/frontend/src/features/chat/hooks/use-chat.ts` — `useUpdateGroup`, `useUpdateMemberRole`, listener `group:updated`
- `apps/frontend/src/features/chat/components/group-settings-modal.tsx` — novo (+ `index.ts`)
- `apps/frontend/src/app/(auth)/mensagens/page.tsx` — botão de engrenagem no header; esconder input p/ VIEWER/onlyAdminsPost

---

## Validação
- `npx tsc --noEmit` (backend + frontend) limpos.
- `npx prisma generate` não é necessário (nenhum campo novo no schema — todos já existem).
- Testar manualmente: admin edita nome/capa → muda para todos em tempo real; toggle "só admins postam" → membro comum é barrado ao enviar; rebaixar último admin → bloqueado.

---

## Fora de escopo (vai para o plano [22](22_grupos_na_gestao.md))
- Vincular grupo a setor/objetivo, hierarquia setor→subsetor, auto-criação por estrutura organizacional, integração com Kanban/estratégia/reuniões.
