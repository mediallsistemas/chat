# Regras de Segurança

Plataforma corporativa de saúde, evoluindo para **SaaS multitenant**. **Isolamento por tenant é
a regra nº 0** (§0) e **isolamento por unidade é a regra nº 1** (§5) — um vazamento entre tenants
ou entre unidades é um incidente de dados. Estas regras refletem o que já está implementado e os
pontos a manter/corrigir.

---

## 0. Isolamento por tenant 🔴 OBRIGATÓRIO — regra nº 0

> **Estado:** 23.1–23.3 implementados (model `Tenant`, `tenant_id` nullable + backfill,
> `TenantGuard` + contexto ALS, auto-escopo via middleware `$use`). RLS (23.5) e subdomínio (23.4)
> são alvo. O auto-escopo já age, mas **mantenha o filtro manual de `unitId`** (§5) — ele é
> independente. Ver `.claude/rules/architecture.md` §0.

- **`Tenant` = o cliente que assina.** Tudo pertence a um tenant (`Unit`, `User`, todos os dados).
  Vazamento entre tenants é **mais grave** que entre unidades (cliente A vê dados do cliente B).
- **Toda query filtra por `tenantId` ANTES de `unitId`.** O `tenantId` vem **do contexto**
  (JWT + subdomínio), **nunca** do path/body — é a fronteira que o usuário não pode atravessar.
- **Auto-escopo (implementado — 23.3):** middleware `$use` do `PrismaService` injeta o tenant em
  toda query (reads filtrados; creates com `tenantId`; `findUnique` pós-filtrado). Em transição,
  escopo "meu tenant OU sem tenant" enquanto nullable. **RLS** habilitada nas 36 tabelas
  (FORCE+policy) mas **inerte sob superuser** — ativar com role dedicada + GUC `app.current_tenant_id`
  (runbook no plano 23). **Não** dispensa o filtro de `unitId` (§5).
- **`JwtPayload` ganha `tenantId`**; guard stack passa a
  `JwtAuthGuard → TenantGuard → BillingGuard → RolesGuard → UnitScopeGuard`.
- **Chave de arquivo** prefixada por tenant: `${tenantId}/${unitId}/${randomUUID()}.${ext}` (§7).
- **Rooms de socket** tenant-scoped: `tenant:<tid>:unit:<unitId>` (§11).
- Único código autorizado a cruzar tenants: contexto `platform/` (dono do SaaS), com guard próprio.

---

## 1. Autenticação e sessão 🔴 OBRIGATÓRIO

- JWT em **cookie `auth_token` HttpOnly**, `sameSite: 'lax'`, `secure` em produção,
  `maxAge` 8h (`auth/auth.service.ts`). Não exponha token ao JS, não mande no header.
- Senhas com **bcrypt cost 12** (`users/users.service.ts`). Não baixe o custo.
- Payload do JWT segue `JwtPayload` de `@mediall/types`: `{ sub, email, role, accessScope, units[] }`.
  `units[]` embarcado no token evita hit no banco a cada request — mantenha enxuto.
- Inatividade: timeout de 7h no front (`features/auth/hooks/use-inactivity-timeout.ts`) +
  8h de validade do cookie. Logout limpa o cookie e invalida o CSRF token.
- `/auth/refresh` **não existe** no backend hoje. O front tenta chamá-lo no 401 e, falhando,
  manda para `/login` (fallback seguro). Se for criar refresh real, faça-o no backend com
  rotação e revisão de CSRF — não confie no comportamento atual.

## 2. Secrets 🔴 OBRIGATÓRIO

- **Nunca** commitar secret. `.env` é gitignored (confirmado: `apps/backend/.env` **não** é
  rastreado pelo git). Documente chaves novas em `.env.example`, com valor vazio/placeholder.
- **Sem fallback de secret no código.** Toda variável crítica deve estar em `REQUIRED_ENV_VARS`
  (`main.ts`) e o app falha no boot se faltar — esse é o padrão correto.
- ⚠️ **Corrigir quando tocar**: ainda existem fallbacks de dev que violam esta regra:
  - `infrastructure/gateway/gateway.module.ts`: `process.env.JWT_SECRET || 'dev-secret'`
    → se `JWT_SECRET` faltar, o socket valida JWT com secret previsível (forjável).
  - `contexts/meetings/meetings.service.ts`: `'devkey'` / `'devsecret'` para LiveKit e
    `accessKey/secret` vazios para MinIO.
  - Padrão a aplicar: ler do env **sem `||` default** e adicionar a chave em `REQUIRED_ENV_VARS`.
- Se um secret real for exposto, **rotacione-o** (não basta remover do arquivo).

## 3. CSRF 🔴 OBRIGATÓRIO

- Double-submit via `csrf-csrf` (`apps/backend/src/csrf.ts`); token **ligado ao `auth_token`**
  (`getSessionIdentifier`). Invalida no login/logout.
- Métodos `GET/HEAD/OPTIONS` são ignorados; **toda mutação** precisa do header `x-csrf-token`.
- No front, o `api.ts` já busca/anexa/retenta o token (403 `EBADCSRFTOKEN`). Use sempre o
  cliente `api` — chamadas axios cruas vão falhar CSRF.

## 4. RBAC (papéis) 🔴 OBRIGATÓRIO

- Autorização por papel via `@Roles(UserRole.X, ...)` + `RolesGuard` (global). Sem `@Roles`,
  o endpoint passa em qualquer papel autenticado — **declare os papéis em toda rota sensível**.
- Papéis vêm de `@mediall/types`. Esconder na UI **não é** controle de acesso (ver `ui.md` §8) —
  o guard no backend é a verdade.

## 5. Isolamento por unidade 🔴 OBRIGATÓRIO — regra nº 1

- **Toda query de dados de unidade filtra por `unitId`.** Sem exceção.
  ```ts
  // ERRADO
  prisma.task.findMany()
  // CERTO
  prisma.task.findMany({ where: { unitId } })
  // CERTO (via relação)
  prisma.message.findMany({ where: { group: { unitId } } })
  ```
- `unitId` vem **sempre do path param** (`units/:unitId/...`), nunca do body.
- `UnitScopeGuard` (global) é a rede de segurança: `GLOBAL` passa; `MULTI/SINGLE` exigem
  `user.units.includes(unitId)`. **Mas o guard não substitui o filtro na query** — ele garante
  acesso à unidade, não que a query só leia daquela unidade.
- Controllers de unidade **estendem `BaseUnitController`** (herdam o guard stack). Não crie
  rota de unidade fora desse padrão.
- Ao revisar/criar service: procure `findMany`/`findFirst`/`aggregate`/`count`/`update`/`delete`
  sem cláusula de unidade — é um possível vazamento. Trate como bloqueante.

## 6. Auditoria 🟡 PADRÃO

- `AuditLogInterceptor` (global) grava `POST/PUT/PATCH/DELETE` em `audit_log`
  (`userId`, `unitId` do path, `action = "METHOD path"`, `ip`). Falha de auditoria é
  engolida para não quebrar request.
- Leitura de auditoria restrita a `SUPER_ADMIN`/`DIRETORIA`.
- Melhoria desejável ao tocar: registrar `entityType`/`entityId` em ações relevantes
  (hoje só método+path). Não regredir a cobertura existente.

## 7. Upload e arquivos (MinIO) 🔴 OBRIGATÓRIO

- Buckets **privados**; acesso só por **signed URL** com expiração (1h hoje,
  `infrastructure/files/files.service.ts`).
- Chave do objeto **prefixada por unidade**: `${unitId}/${randomUUID()}.${ext}` — preserva
  isolamento. Não gere chave sem o prefixo de unidade.
- Limite de tamanho aplicado (20MB). ⚠️ **Validar MIME real** (magic bytes), não confiar na
  extensão do nome — corrigir ao mexer em upload.
- `useSSL` em produção; credenciais MinIO vêm do env (ver §2, sem default vazio).

## 8. Validação de entrada 🔴 OBRIGATÓRIO

- `ValidationPipe` global com `whitelist` + `forbidNonWhitelisted` + `transform`. Todo DTO
  precisa de decorators `class-validator` (`@IsUUID`, `@IsEmail`, `@IsEnum`, limites em paginação).
- Sem decorator, o campo é descartado silenciosamente — não dependa de propriedade não validada.
- Nada de SQL cru / interpolação; use Prisma. Nada de `eval`/HTML não sanitizado vindo do usuário.

## 9. Rate limit e lockout 🔴 OBRIGATÓRIO

- Login: `@Throttle({ default: { ttl: 60_000, limit: 5 } })` — 5/min. Global: 100/min
  (`ThrottlerModule` em `app.module.ts`).
- Lockout após **5 falhas** (`lockedAt`); desbloqueio só por admin (`/users/:id/unlock`).
  Não remova o lockout nem o auto-desbloqueie sem decisão de produto.

## 10. Headers HTTP e CORS 🔴 OBRIGATÓRIO

- `helmet` com CSP `defaultSrc 'self'`, `scriptSrc 'self'` (`main.ts`). Não afrouxe
  `scriptSrc` para `'unsafe-inline'`/`'unsafe-eval'`. (`styleSrc` permite inline — trade-off aceito.)
- CORS restrito a `FRONTEND_URL` com `credentials: true`. Não use `origin: '*'` com credenciais.

## 11. Auth de WebSocket 🔴 OBRIGATÓRIO

- `handleConnection` verifica o JWT (do `auth.token` do handshake ou do cookie `auth_token`);
  sem token válido → `disconnect()`. Usuário entra só nas rooms das suas `units`.
- Não emita evento para fora do escopo do usuário; respeite as rooms `unit:/group:/meeting:`.
- ⚠️ Depende do `JwtModule` do gateway — ver §2 (fallback `'dev-secret'` a remover).

## 12. Checklist rápido antes de PR que toca dados/auth

- [ ] Query nova filtra por `unitId` (ou por relação até a unidade)?
- [ ] Rota nova é controller de unidade estendendo `BaseUnitController` com `@Roles` adequado?
- [ ] DTO novo tem decorators de validação?
- [ ] Mutation passa pelo cliente `api` (CSRF) e não por axios cru?
- [ ] Nenhum secret hardcoded / nenhum `|| 'default'` para chave sensível?
- [ ] Var de ambiente nova adicionada a `REQUIRED_ENV_VARS` e `.env.example`?
- [ ] Upload usa chave prefixada por unidade e signed URL?
