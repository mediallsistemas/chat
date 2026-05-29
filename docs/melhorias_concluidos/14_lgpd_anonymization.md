# 14 — LGPD: Direito ao Esquecimento (Art. 18)
> ⚠️ **Dependência:** Fazer APÓS os planos 04 (Users Role Guard) e 13 (User Consent). Modifica `users.controller.ts` que já foi editado pelo 04 — adicionar ao final do arquivo sem remover o que o 04 criou.
**Prioridade:** 🔴 Crítico — risco legal
**Tempo estimado:** 4h
**Área:** LGPD / Compliance

---

## Base Legal

Art. 18, IV da LGPD — o titular tem direito à anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade.

---

## Implementação

### 1. Estratégia: Anonimização (não exclusão)

Excluir o usuário quebraria referências em audit_log, tarefas, tickets, mensagens históricas. A estratégia correta é **anonimizar** — substituir dados pessoais por valores genéricos, mantendo o histórico operacional intacto.

```
Antes: { name: "João Silva", email: "joao@mediall.com", avatarUrl: "..." }
Depois: { name: "Usuário Removido", email: "removido_abc123@mediall.invalid", avatarUrl: null }
```

### 2. Criar método de anonimização

```typescript
// apps/backend/src/contexts/users/users.service.ts
import { randomBytes } from 'crypto'

async anonymizeUser(userId: string, requestedBy: string): Promise<void> {
  const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })

  const anonymousId = randomBytes(8).toString('hex')

  await this.prisma.$transaction([
    // 1. Anonimizar dados pessoais do usuário
    this.prisma.user.update({
      where: { id: userId },
      data: {
        name: 'Usuário Removido',
        email: `removido_${anonymousId}@mediall.invalid`,
        passwordHash: 'ANONYMIZED',
        avatarUrl: null,
        phone: null,
        isActive: false,
        // Manter: id, createdAt, role (para auditoria histórica)
      },
    }),

    // 2. Revogar todas as sessões ativas
    this.prisma.refreshToken?.deleteMany({ where: { userId } }),

    // 3. Remover assinaturas push
    this.prisma.pushSubscription.deleteMany({ where: { userId } }),

    // 4. Registrar a anonimização no audit log
    this.prisma.auditLog.create({
      data: {
        userId: requestedBy,
        action: 'ANONYMIZE_USER',
        entityType: 'User',
        entityId: userId,
        metadata: { reason: 'LGPD Art. 18 - Direito ao esquecimento' },
      },
    }),
  ])
}
```

### 3. Endpoint restrito a SUPER_ADMIN

```typescript
// apps/backend/src/contexts/users/users.controller.ts
@Delete(':userId/personal-data')
@Roles(UserRole.SUPER_ADMIN)
@HttpCode(HttpStatus.NO_CONTENT)
async anonymizeUser(
  @Param('userId') userId: string,
  @GetUser() requester: JwtPayload,
) {
  // Impedir auto-anonimização por segurança
  if (userId === requester.sub) {
    throw new ForbiddenException('Cannot anonymize your own account')
  }
  await this.usersService.anonymizeUser(userId, requester.sub)
}
```

### 4. Exportação de dados pessoais (portabilidade — Art. 18, V)

```typescript
// apps/backend/src/contexts/users/users.service.ts
async exportUserData(userId: string) {
  const [user, messages, tickets, auditLogs] = await Promise.all([
    this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    this.prisma.message.findMany({
      where: { senderId: userId },
      select: { content: true, createdAt: true, group: { select: { name: true } } },
      take: 1000, // Limitar por performance
    }),
    this.prisma.ticket.findMany({
      where: { reportedBy: userId },
      select: { title: true, description: true, status: true, createdAt: true },
    }),
    this.prisma.auditLog.findMany({
      where: { userId },
      select: { action: true, entityType: true, createdAt: true },
      take: 500,
    }),
  ])

  return { user, messages, tickets, auditLogs, exportedAt: new Date().toISOString() }
}
```

```typescript
// apps/backend/src/contexts/users/users.controller.ts
@Get(':userId/my-data')
@Roles(UserRole.SUPER_ADMIN)
async exportUserData(@Param('userId') userId: string) {
  return this.usersService.exportUserData(userId)
}
```

### 5. Processo operacional recomendado

Criar processo interno (não técnico):

1. Usuário envia solicitação formal por e-mail para o DPO (Data Protection Officer)
2. DPO valida identidade do solicitante
3. DPO tem até **15 dias** para responder (prazo LGPD)
4. SUPER_ADMIN executa anonimização via endpoint
5. DPO confirma por e-mail ao solicitante

---

## Arquivos modificados
- `apps/backend/src/contexts/users/users.service.ts` — anonymizeUser(), exportUserData()
- `apps/backend/src/contexts/users/users.controller.ts` — DELETE /:userId/personal-data, GET /:userId/my-data
- `apps/backend/prisma/schema.prisma` — garantir campo phone em User (se não existir)
