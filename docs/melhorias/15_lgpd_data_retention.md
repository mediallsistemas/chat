# 15 — LGPD: Política de Retenção de Dados
> ⚠️ **Dependência:** Fazer APÓS o plano 13 (User Consent). Modifica `schema.prisma` — gerar nova migration separada após as migrations dos planos 12 e 13. Modifica `notifications.service.ts` — o Logger do plano 07 já deve existir.
**Prioridade:** 🟠 Alta
**Tempo estimado:** 4h
**Área:** LGPD / Compliance

---

## Base Legal

Art. 15 da LGPD — o tratamento de dados pessoais termina ao fim da finalidade que motivou o tratamento. Dados devem ser eliminados após o período de retenção necessário.

---

## Política de Retenção Definida

| Tipo de Dado | Retenção | Justificativa |
|--------------|----------|---------------|
| Mensagens de chat | 2 anos | Comunicação operacional |
| Documentos institucionais | 5 anos | Requisito regulatório hospitalar (CFM) |
| Tickets/Chamados | 3 anos | Histórico de suporte |
| Logs de auditoria | 5 anos | Compliance e investigações |
| Notificações | 90 dias | Notificações são efêmeras |
| Tokens de push | Até revogação | Dados de sessão |
| Sessões expiradas | 7 dias | Limpeza operacional |
| Logs de reunião | 2 anos | Histórico operacional |

---

## Implementação

### 1. Adicionar campo expiresAt onde aplicável

```prisma
// apps/backend/prisma/schema.prisma

model Notification {
  // ... campos existentes
  expiresAt DateTime? @map("expires_at") // 90 dias após criação
}

model Message {
  // ... campos existentes
  // Retenção controlada por job (não campo) — mensagens de grupos específicos
}
```

### 2. Criar DataRetentionJob

```typescript
// apps/backend/src/jobs/data-retention.job.ts
import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class DataRetentionJob {
  private readonly logger = new Logger(DataRetentionJob.name)

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run() {
    this.logger.log('Data retention job started')

    const results = await Promise.allSettled([
      this.purgeNotifications(),
      this.purgeExpiredMessages(),
      this.purgeOldAuditLogs(),
    ])

    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        this.logger.error(`Retention task ${i} failed`, result.reason)
      }
    })

    this.logger.log('Data retention job completed')
  }

  private async purgeNotifications() {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90) // 90 dias

    const { count } = await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })

    this.logger.log(`Purged ${count} old notifications`)
  }

  private async purgeExpiredMessages() {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 2) // 2 anos

    // Apenas mensagens de grupos temporários (não grupos institucionais permanentes)
    const { count } = await this.prisma.message.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        group: { type: 'TEMPORARY' },
      },
    })

    this.logger.log(`Purged ${count} old temporary group messages`)
  }

  private async purgeOldAuditLogs() {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 5) // 5 anos

    const { count } = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })

    this.logger.log(`Purged ${count} old audit logs`)
  }
}
```

### 3. Definir expiresAt ao criar notificações

```typescript
// apps/backend/src/notifications/notifications.service.ts
async create(dto: CreateNotificationDto) {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 90)

  return this.prisma.notification.create({
    data: {
      ...dto,
      expiresAt, // Agora tem prazo definido
    },
  })
}
```

### 4. Registrar no AppModule

```typescript
// apps/backend/src/app.module.ts
import { DataRetentionJob } from './jobs/data-retention.job'

@Module({
  providers: [
    DataRetentionJob,
    // ... outros jobs
  ],
})
```

### 5. Documento de Política (não técnico)

Criar `docs/POLITICA_RETENCAO_DADOS.md` com:
- Tabela de retenção por tipo de dado
- Responsável pelo processo (DPO ou SUPER_ADMIN)
- Processo de solicitação de exclusão
- Data de revisão anual da política

---

## Verificação

```bash
# Simular execução do job manualmente
# Adicionar endpoint temporário apenas em desenvolvimento:
@Get('admin/data-retention/run')
@Roles(UserRole.SUPER_ADMIN)
async runRetention() {
  await this.dataRetentionJob.run()
  return { ok: true }
}
```

---

## Arquivos criados/modificados
- `apps/backend/src/jobs/data-retention.job.ts` — novo
- `apps/backend/src/app.module.ts` — registrar DataRetentionJob
- `apps/backend/prisma/schema.prisma` — campo expiresAt em Notification
- `apps/backend/src/notifications/notifications.service.ts` — definir expiresAt na criação
- Nova migration Prisma
