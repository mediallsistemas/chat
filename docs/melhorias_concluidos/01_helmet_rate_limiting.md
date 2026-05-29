# 01 — Helmet + Rate Limiting
**Prioridade:** 🔴 Crítico — fazer antes do go-live
**Tempo estimado:** 1h
**Área:** Segurança

---

## Problema

Sem `helmet`, o servidor não envia headers HTTP de segurança. Sem `@nestjs/throttler`, qualquer bot pode fazer chamadas ilimitadas ao endpoint de login.

---

## Implementação

### 1. Instalar pacotes

```bash
cd apps/backend
npm i helmet @nestjs/throttler
```

### 2. Registrar ThrottlerModule no AppModule

```typescript
// apps/backend/src/app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60_000, limit: 100 }, // 100 req/min padrão
    ]),
    // ...outros módulos
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // ...outros guards já existentes
  ],
})
```

### 3. Aplicar limite mais restrito no endpoint de login

```typescript
// apps/backend/src/contexts/auth/auth.controller.ts
import { Throttle, SkipThrottle } from '@nestjs/throttler'

@Throttle({ default: { ttl: 60_000, limit: 5 } }) // 5 tentativas/min
@Post('login')
login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) { ... }
```

### 4. Adicionar Helmet no main.ts

```typescript
// apps/backend/src/main.ts
import helmet from 'helmet'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Adicionar logo após criar o app, antes de qualquer outro middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // necessário para Swagger UI
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false, // necessário para LiveKit
  }))

  // ... resto do bootstrap
}
```

### 5. Ignorar throttle em endpoints públicos (opcional)

```typescript
// Endpoints que não precisam de limite (ex: health check)
@SkipThrottle()
@Get('health')
healthCheck() { ... }
```

---

## Verificação

Após implementar, testar com:
```bash
# Deve retornar headers de segurança
curl -I http://localhost:4000/api/health

# Deve retornar 429 após 5 tentativas em 1 minuto
for i in {1..6}; do curl -X POST http://localhost:4000/api/auth/login -d '{}'; done
```

Headers esperados na resposta:
```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 0
Strict-Transport-Security: max-age=15552000; includeSubDomains
Content-Security-Policy: ...
```

---

## Arquivos modificados
- `apps/backend/package.json` — adicionar helmet, @nestjs/throttler
- `apps/backend/src/main.ts` — app.use(helmet())
- `apps/backend/src/app.module.ts` — ThrottlerModule + ThrottlerGuard
- `apps/backend/src/contexts/auth/auth.controller.ts` — @Throttle no login
