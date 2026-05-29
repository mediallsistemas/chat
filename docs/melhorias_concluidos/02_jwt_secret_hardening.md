# 02 — JWT Secret Hardening
**Prioridade:** 🔴 Crítico — fazer antes do go-live
**Tempo estimado:** 15min
**Área:** Segurança

---

## Problema

Em `jwt.strategy.ts` existe um fallback `|| 'dev-secret'`. Se a variável de ambiente `JWT_SECRET` não estiver configurada em produção, todos os tokens serão assinados com uma string conhecida — qualquer pessoa pode forjar tokens válidos.

```typescript
// SITUAÇÃO ATUAL — PERIGOSO
secret: process.env.JWT_SECRET || 'dev-secret'
```

---

## Implementação

### 1. Remover fallback no JWT Strategy

```typescript
// apps/backend/src/contexts/auth/strategies/jwt.strategy.ts
import { Injectable, Logger } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Environment variable ${key} is required but not set`)
  return value
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.access_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secret: requireEnv('JWT_SECRET'),
    })
  }

  async validate(payload: JwtPayload) {
    return payload
  }
}
```

### 2. Verificar se há outros usos do fallback

Buscar no projeto por:
```bash
grep -r "|| 'dev-secret'" apps/backend/src/
grep -r "JWT_SECRET" apps/backend/src/
```

Garantir que `JWT_SECRET` aparece apenas como `process.env.JWT_SECRET` sem fallback em produção.

### 3. Adicionar validação de variáveis de ambiente no bootstrap

```typescript
// apps/backend/src/main.ts
const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'DATABASE_URL',
  'REDIS_HOST',
  'MINIO_ENDPOINT',
]

async function bootstrap() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }

  const app = await NestFactory.create(AppModule)
  // ...
}
```

### 4. Atualizar .env.example

Garantir que `.env.example` documenta o JWT_SECRET com instrução clara:

```env
# OBRIGATÓRIO — gerar com: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=seu_secret_aqui_minimo_64_chars

# OBRIGATÓRIO — secret diferente do access token
JWT_REFRESH_SECRET=outro_secret_aqui_minimo_64_chars
```

---

## Gerar um secret seguro

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copiar o output e colocar no `.env` de produção.

---

## Arquivos modificados
- `apps/backend/src/contexts/auth/strategies/jwt.strategy.ts` — remover fallback, usar requireEnv()
- `apps/backend/src/main.ts` — validação de env vars no bootstrap
- `.env.example` — instrução de geração do secret
