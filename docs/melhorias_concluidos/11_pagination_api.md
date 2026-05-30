# 11 — Paginação nas APIs
**Prioridade:** 🟠 Alta — primeira semana pós go-live
**Tempo estimado:** 4h
**Área:** Design de API + Escalabilidade

---

## Problema

Endpoints como `GET /tickets`, `GET /documents`, `GET /audit-logs` retornam todos os registros sem limite. Com 10.000 tickets, a query retorna tudo de uma vez — timeout de banco, memória estourada no Node, lentidão no frontend.

---

## Implementação

### 1. Criar DTO de paginação reutilizável

```typescript
// apps/backend/src/shared/dto/pagination.dto.ts
import { IsOptional, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class PaginationDto {
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0
}
```

### 2. Criar tipo de resposta paginada

```typescript
// packages/types/src/pagination.ts
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}
```

```typescript
// packages/types/src/index.ts
export * from './pagination'
```

### 3. Utilitário para query paginada no Prisma

```typescript
// apps/backend/src/shared/utils/paginate.ts
export async function paginate<T>(
  model: { findMany: Function; count: Function },
  args: { where?: object; include?: object; orderBy?: object },
  pagination: { limit?: number; offset?: number },
) {
  const limit = pagination.limit ?? 20
  const offset = pagination.offset ?? 0

  const [items, total] = await Promise.all([
    model.findMany({ ...args, take: limit, skip: offset }),
    model.count({ where: args.where }),
  ])

  return {
    data: items as T[],
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  }
}
```

### 4. Aplicar em TicketsService

```typescript
// apps/backend/src/tickets/tickets.service.ts
import { PaginationDto } from '@/common/dto/pagination.dto'
import { paginate } from '@/common/utils/paginate'

async findAll(unitId: string, query: TicketsQueryDto & PaginationDto) {
  return paginate(
    this.prisma.ticket,
    {
      where: {
        unitId,
        ...(query.status && { status: query.status }),
        ...(query.priority && { priority: query.priority }),
      },
      include: {
        reporter: { select: { id: true, name: true, avatarUrl: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    },
    { limit: query.limit, offset: query.offset },
  )
}
```

```typescript
// apps/backend/src/tickets/tickets.controller.ts
@Get()
findAll(
  @Param('unitId') unitId: string,
  @Query() query: TicketsQueryDto,
) {
  return this.ticketsService.findAll(unitId, query)
}
```

### 5. Aplicar nos demais endpoints

Endpoints prioritários a paginar:
- `GET /units/:unitId/tickets`
- `GET /units/:unitId/documents`
- `GET /units/:unitId/document-folders`
- `GET /units/:unitId/audit-logs` (já tem paginação manual — migrar para o padrão)
- `GET /units/:unitId/impediments`

### 6. Frontend — atualizar hooks para suportar paginação

```typescript
// apps/frontend/src/hooks/use-tickets.ts
export function useTickets(params?: { status?: TicketStatus; limit?: number; offset?: number }) {
  const { activeUnit } = useUnitStore()
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status', params.status)
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))

  return useQuery({
    queryKey: ['tickets', activeUnit?.id, params],
    queryFn: async () => {
      const res = await api.get<{ data: PaginatedResponse<Ticket> }>(
        `/units/${activeUnit!.id}/tickets?${searchParams}`
      )
      return res.data.data
    },
    enabled: !!activeUnit?.id,
  })
}
```

```typescript
// Uso na página de chamados — com load more simples
const [offset, setOffset] = useState(0)
const { data } = useTickets({ status: statusFilter, limit: 20, offset })

// Botão "Carregar mais"
{data?.hasMore && (
  <Button variant="secondary" onClick={() => setOffset(o => o + 20)}>
    Carregar mais
  </Button>
)}
```

---

## Arquivos criados/modificados
- `apps/backend/src/shared/dto/pagination.dto.ts` — novo
- `apps/backend/src/shared/utils/paginate.ts` — novo
- `packages/types/src/pagination.ts` — novo
- `packages/types/src/index.ts` — export pagination
- `apps/backend/src/tickets/tickets.service.ts` — usar paginate()
- `apps/backend/src/tickets/tickets.controller.ts` — aceitar PaginationDto
- `apps/backend/src/documents/documents.service.ts` — usar paginate()
- `apps/frontend/src/hooks/use-tickets.ts` — suporte a paginação
- `apps/frontend/src/app/(auth)/chamados/page.tsx` — "Carregar mais"
