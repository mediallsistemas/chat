# 17 — Versionamento de API
> ⚠️ **Dependência:** Fazer APÓS os planos 03 (CSRF) e 09 (Correlation ID) — atualiza a `baseURL` do `api.ts` para `/api/v1`, o que afeta os interceptors já configurados por esses planos. Ver estado final do `api.ts` em `00_ORDEM_EXECUCAO.md`.
**Prioridade:** 🟡 Média — antes de lançar app mobile
**Tempo estimado:** 3h
**Área:** Design de API + Escalabilidade

---

## Problema

Sem versionamento, qualquer breaking change na API (renomear campo, mudar tipo de resposta, remover endpoint) precisa ser feita simultaneamente no backend E no frontend. Com um app mobile futuro, isso é inviável — usuários com versão antiga do app continuariam quebrando.

---

## Implementação

### 1. Habilitar versionamento no main.ts

```typescript
// apps/backend/src/main.ts
import { VersioningType } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableVersioning({
    type: VersioningType.URI,           // /api/v1/...
    defaultVersion: '1',               // Versão padrão se não especificada
  })

  // Prefixo global vira /api/v1/...
  app.setGlobalPrefix('api')

  // ...
}
```

### 2. Versionar controllers existentes

```typescript
// Opção A — versionar todo o controller
@Controller({ path: 'tickets', version: '1' })
export class TicketsController extends BaseUnitController { }
// Rotas: GET /api/v1/units/:unitId/tickets

// Opção B — versionar endpoint específico (para mudanças pontuais)
@Get()
@Version('1')
findAllV1() { return this.ticketsService.findAll(...) }

@Get()
@Version('2')
findAllV2() { return this.ticketsService.findAllV2(...) } // Novo formato
```

### 3. Migração gradual (zero downtime)

Estratégia para não quebrar o frontend atual:

```typescript
// Manter v1 funcionando durante a transição
@Controller({ path: 'tickets', version: ['1', '2'] })
// Aceita /v1/ e /v2/ com o mesmo controller temporariamente
```

### 4. Atualizar BaseUnitController

```typescript
// apps/backend/src/common/controllers/base-unit.controller.ts
import { Controller, UseGuards, Version } from '@nestjs/common'
import { JwtAuthGuard, RolesGuard, UnitScopeGuard } from '@/common/guards'

// O BaseUnitController não define versão — cada controller filho define a sua
@Controller('units/:unitId')
@UseGuards(JwtAuthGuard, RolesGuard, UnitScopeGuard)
export abstract class BaseUnitController {}
```

### 5. Atualizar frontend para usar v1

```typescript
// apps/frontend/src/lib/api.ts
export const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1`,
  withCredentials: true,
})
```

### 6. Swagger por versão

```typescript
// apps/backend/src/main.ts
// Criar documento Swagger separado por versão
const v1Config = new DocumentBuilder()
  .setTitle('Mediall API v1')
  .setVersion('1.0')
  .addCookieAuth('access_token')
  .build()

const v1Document = SwaggerModule.createDocument(app, v1Config, {
  include: [/* módulos v1 */],
})
SwaggerModule.setup('api/v1/docs', app, v1Document)
```

### 7. Convenções de versionamento

| Situação | Ação |
|----------|------|
| Novo campo opcional na resposta | Sem nova versão (backward compatible) |
| Campo renomeado | Nova versão (v2) |
| Campo removido | Nova versão (v2) |
| Novo endpoint | Sem nova versão |
| Endpoint removido | Deprecar na v1, remover na v3 |
| Mudança de tipo de campo | Nova versão (v2) |

### 8. Deprecação de versão antiga

```typescript
// Adicionar header de aviso quando v1 for deprecada futuramente
@Get()
@Version('1')
@Header('Deprecation', 'true')
@Header('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT')
findAllV1() { ... }
```

---

## Arquivos modificados
- `apps/backend/src/main.ts` — enableVersioning()
- `apps/backend/src/tickets/tickets.controller.ts` — adicionar version: '1'
- `apps/backend/src/documents/documents.controller.ts` — version: '1'
- (todos os controllers de módulos)
- `apps/frontend/src/lib/api.ts` — atualizar baseURL para /api/v1
