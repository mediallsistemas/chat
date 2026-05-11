# 12 — Indexes Compostos no Banco
**Prioridade:** 🟠 Alta — primeira semana pós go-live
**Tempo estimado:** 1h
**Área:** Performance + Escalabilidade

---

## Problema

As queries mais comuns filtram por `(unitId + status)`, `(unitId + createdAt)`, `(groupId + createdAt)`. Sem indexes compostos, o Postgres faz full table scan — lento com volumes altos.

---

## Implementação

### 1. Adicionar indexes ao schema.prisma

```prisma
// apps/backend/prisma/schema.prisma

model Ticket {
  // ... campos existentes

  @@index([unitId, status])          // filtrar chamados por unidade + status
  @@index([unitId, priority])        // filtrar por prioridade
  @@index([unitId, createdAt])       // ordenar por data
  @@index([assignedTo, status])      // "meus chamados abertos"
}

model Document {
  // ... campos existentes

  @@index([unitId, folderId])        // listar documentos de uma pasta
  @@index([unitId, createdAt])       // ordenar por data
}

model DocumentFolder {
  // ... campos existentes

  @@index([unitId])                  // listar pastas da unidade
}

model Impediment {
  // ... campos existentes

  @@index([unitId, status])          // filtrar impedimentos ativos
  @@index([unitId, createdAt])       // relatórios por período
  @@index([escalationLevel])         // job de escalonamento
}

model Message {
  // ... campos existentes

  @@index([groupId, createdAt])      // paginação de mensagens (já existe? verificar)
  @@index([groupId, isPinned])       // mensagens fixadas
}

model Notification {
  // ... campos existentes
  // Verificar se @@index([userId, isRead]) já existe — se não, adicionar
  @@index([userId, isRead])
  @@index([unitId, createdAt])
}

model AuditLog {
  // ... campos existentes

  @@index([unitId, createdAt])       // queries de auditoria por período
  @@index([userId, createdAt])       // ações de um usuário específico
  @@index([entityType, entityId])    // histórico de um registro específico
}

model Task {
  // ... campos existentes

  @@index([columnId, position])      // ordenação no Kanban
  @@index([responsibleUserId, completedAt]) // tarefas pendentes por usuário
}
```

### 2. Gerar e aplicar migration

```bash
cd apps/backend
npx prisma migrate dev --name add_composite_indexes
```

### 3. Verificar indexes existentes (antes de adicionar)

Para não criar duplicatas, verificar o que já existe:

```bash
npx prisma db pull # Sincronizar schema com banco atual
```

Ou via SQL:
```sql
-- Ver todos os indexes de uma tabela
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'tickets'
ORDER BY indexname;
```

### 4. Analisar queries lentas em produção

Após go-live, ativar `pg_stat_statements` no Postgres para identificar queries que precisam de index:

```sql
-- Ativar extensão
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 10 queries mais lentas
SELECT
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 5. Configurar Prisma para log de queries lentas

```typescript
// apps/backend/src/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
      ],
    })
  }

  async onModuleInit() {
    await this.$connect()

    // Log apenas queries que demoram mais de 500ms
    this.$on('query' as any, (e: any) => {
      if (e.duration > 500) {
        this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`)
      }
    })
  }
}
```

---

## Estimativa de impacto

| Tabela | Query | Antes (sem index) | Depois (com index) |
|--------|-------|------------------|--------------------|
| tickets | unitId + status | ~200ms com 10k rows | ~5ms |
| messages | groupId + createdAt | ~500ms com 100k msgs | ~10ms |
| audit_log | unitId + createdAt | ~1s com 500k logs | ~15ms |

---

## Arquivos modificados
- `apps/backend/prisma/schema.prisma` — adicionar @@index nos modelos
- `apps/backend/src/prisma/prisma.service.ts` — log de queries lentas
- Nova migration gerada automaticamente pelo Prisma
