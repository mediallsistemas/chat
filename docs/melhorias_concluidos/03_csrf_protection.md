# 03 — Proteção CSRF
> ⚠️ **Dependência:** Fazer após o plano 01 (Helmet) e 02 (JWT). Modifica `main.ts` e `api.ts` — ver `00_ORDEM_EXECUCAO.md` para o estado final desses arquivos.
**Prioridade:** 🔴 Crítico — fazer antes do go-live
**Tempo estimado:** 3h
**Área:** Segurança

---

## Problema

O sistema usa autenticação por cookie (`httpOnly`). Autenticação por cookie é vulnerável a ataques CSRF (Cross-Site Request Forgery): um site malicioso pode fazer requisições autenticadas em nome do usuário porque o browser envia cookies automaticamente.

---

## Solução recomendada: Double-Submit Cookie

Padrão sem estado que funciona bem com Next.js + NestJS:

1. Backend gera um token CSRF aleatório e o envia em **dois lugares**: cookie acessível por JS + header da resposta
2. Frontend lê o cookie e envia o valor no header `X-CSRF-Token` em toda mutação
3. Backend valida que o header bate com o cookie

---

## Implementação

### 1. Instalar pacote

```bash
cd apps/backend
npm i csrf-csrf
```

### 2. Configurar no main.ts

```typescript
// apps/backend/src/main.ts
import { doubleCsrf } from 'csrf-csrf'
import cookieParser from 'cookie-parser'

// cookie-parser é necessário para ler cookies no express
npm i cookie-parser @types/cookie-parser

const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!,
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: false,   // JS precisa ler para enviar no header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
})

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.use(cookieParser())
  app.use(doubleCsrfProtection)
  // ...
}
```

### 3. Endpoint para obter token CSRF

```typescript
// apps/backend/src/contexts/auth/auth.controller.ts
@Public()
@Get('csrf-token')
getCsrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  const token = generateToken(req, res)
  return { csrfToken: token }
}
```

### 4. Frontend — buscar e enviar o token

```typescript
// apps/frontend/src/lib/api.ts
import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
})

// Buscar token CSRF na inicialização
let csrfToken: string | null = null

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  const res = await axios.get('/api/auth/csrf-token', { withCredentials: true })
  csrfToken = res.data.csrfToken
  return csrfToken
}

// Interceptor que adiciona o token em todas as mutações
api.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase()
  if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    config.headers['x-csrf-token'] = await getCsrfToken()
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Renovar token CSRF se expirado (403 com mensagem específica)
    if (error.response?.status === 403 && error.response?.data?.message === 'invalid csrf token') {
      csrfToken = null
      // Retry a requisição original com novo token
      const newToken = await getCsrfToken()
      error.config.headers['x-csrf-token'] = newToken
      return api.request(error.config)
    }

    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/')) {
      window.location.href = '/login'
    }

    return Promise.reject(error)
  },
)
```

### 5. Adicionar CSRF_SECRET ao .env

```env
# Gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CSRF_SECRET=seu_csrf_secret_aqui
```

---

## Arquivos modificados
- `apps/backend/package.json` — csrf-csrf, cookie-parser
- `apps/backend/src/main.ts` — doubleCsrfProtection middleware
- `apps/backend/src/contexts/auth/auth.controller.ts` — GET csrf-token endpoint
- `apps/frontend/src/lib/api.ts` — interceptor que envia x-csrf-token
- `.env.example` — CSRF_SECRET
