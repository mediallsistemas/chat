# 06 — Health Check Endpoint
**Prioridade:** 🔴 Crítico — fazer antes do go-live
**Tempo estimado:** 1h
**Área:** Observabilidade + DevOps

---

## Problema

Sem endpoint `/health`, não é possível:
- Configurar healthcheck no Docker Compose
- Usar um monitor de uptime (UptimeRobot, BetterStack)
- Detectar automaticamente quando o banco ou Redis estão fora
- Configurar load balancer para remover instâncias doentes

---

## Implementação

### 1. Instalar @nestjs/terminus

```bash
cd apps/backend
npm i @nestjs/terminus
```

### 2. Criar HealthModule

```typescript
// apps/backend/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckService, PrismaHealthIndicator, HttpHealthIndicator } from '@nestjs/terminus'
import { PrismaService } from '@/prisma/prisma.service'
import { Public } from '@/common/decorators/public.decorator'
import { SkipThrottle } from '@nestjs/throttler'
import { ApiTags, ApiOperation } from '@nestjs/swagger'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Verifica saúde da aplicação e dependências' })
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ])
  }
}
```

```typescript
// apps/backend/src/health/health.module.ts
import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { PrismaModule } from '@/prisma/prisma.module'
import { HealthController } from './health.controller'

@Module({
  imports: [TerminusModule, PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

### 3. Registrar no AppModule

```typescript
// apps/backend/src/app.module.ts
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    HealthModule,
    // ... outros módulos
  ],
})
```

### 4. Resposta esperada

```json
// GET /api/health — quando tudo está ok
{
  "status": "ok",
  "info": {
    "database": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" }
  }
}

// Quando o banco está fora — retorna 503
{
  "status": "error",
  "info": {},
  "error": {
    "database": { "status": "down", "message": "connect ECONNREFUSED" }
  }
}
```

### 5. Configurar no Docker Compose

```yaml
# docker-compose.yml
services:
  nestjs:
    image: mediall-backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 6. Configurar monitor externo

No UptimeRobot ou BetterStack:
- URL: `https://seudominio.com/api/health`
- Tipo: HTTP
- Intervalo: 5 minutos
- Alerta: e-mail/Slack quando status != 200

---

## Arquivos criados/modificados
- `apps/backend/src/health/health.controller.ts` — novo
- `apps/backend/src/health/health.module.ts` — novo
- `apps/backend/src/app.module.ts` — adicionar HealthModule
- `docker-compose.yml` — healthcheck no serviço nestjs
