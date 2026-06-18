# Plano 02 — Autenticação e Permissões
## JWT, Guards, RBAC, Multi-unidade, Holding

---

## Objetivo
Implementar o sistema de autenticação e controle de acesso contemplando a hierarquia da holding Mediall com múltiplas unidades.

---

## Fluxo de Autenticação

```
POST /api/auth/login
  → Valida credenciais no PostgreSQL
  → Gera JWT com payload completo
  → Seta HttpOnly Cookie (auth_token, 15min access + 7d refresh)
  → Retorna dados do usuário

Logout
  → Limpa cookie server-side
  → Invalida refresh token no Redis
```

---

## Payload do JWT

```typescript
{
  sub: userId,           // UUID
  email: string,
  role: UserRole,        // enum abaixo
  accessScope: 'GLOBAL' | 'MULTI' | 'SINGLE',
  units: string[],       // IDs das unidades com acesso
  iat: number,
  exp: number
}
```

> Incluir `units` no token evita queries ao banco a cada requisição para verificar acesso.

---

## Roles

| Role | Quem é | O que pode |
|------|--------|-----------|
| SUPER_ADMIN | TI / Gestor do sistema | Tudo. Configurações globais, logs, usuários |
| DIRETORIA | Diretores da holding | Ver todos os setores, criar planos, painel consolidado |
| GESTOR | Coordenadores / Gerentes | Gerenciar tarefas e equipe do seu setor/unidade |
| COLABORADOR | Equipe operacional | Tarefas do seu grupo, impedimentos, chat |
| VISUALIZADOR | Auditores / Convidados | Somente leitura, acesso temporário |

---

## Escopos de Acesso (Multi-unidade)

```typescript
enum AccessScope {
  GLOBAL  // Vê todas as unidades — geralmente Diretoria e SUPER_ADMIN
  MULTI   // Vê 2+ unidades específicas — ex: gestor que cobre duas unidades
  SINGLE  // Vê apenas sua unidade — maioria dos colaboradores
}
```

### Comportamento por escopo no frontend

**GLOBAL** — Painel mostra consolidado de todas as unidades. Pode navegar livremente entre elas.

**MULTI** — Seletor de contexto no header: `"Acessando: [UPA Goiânia ▼]"`. Alterna entre as unidades autorizadas.

**SINGLE** — Entra direto na sua unidade. Sem seletor, sem visibilidade de outras.

---

## Guard Stack (NestJS)

Aplicado em sequência em todas as rotas protegidas:

```
JwtAuthGuard → RolesGuard → UnitScopeGuard
```

### JwtAuthGuard
Valida o token JWT. Rejeita se expirado ou inválido.

### RolesGuard
Verifica se o role do usuário tem permissão para o endpoint.
Usa decorator `@Roles(UserRole.GESTOR, UserRole.DIRETORIA)`.

### UnitScopeGuard
Valida se o usuário tem acesso à unidade presente na rota.
- GLOBAL: sempre passa
- MULTI/SINGLE: verifica se `unitId` da rota está no array `units` do token

---

## BaseUnitController

Todo controller que envolve uma unidade herda este controller base:

```typescript
@Controller('units/:unitId')
export abstract class BaseUnitController {
  // Valida automaticamente que o usuário tem acesso ao unitId da rota
  // Evita repetir lógica em cada controller
}
```

---

## Tabela: user_units (relação N:N)

```
user_units
- id           UUID PK
- user_id      FK → users
- unit_id      FK → units
- role         ENUM (role dentro desta unidade especificamente)
- is_primary   boolean (unidade principal do usuário)
- granted_by   FK → users
- granted_at   timestamp
- expires_at   timestamp nullable (acesso temporário)
```

> Um usuário pode ter roles diferentes em unidades diferentes.
> Ex: Dr. Gabriel é DIRETORIA na Matriz, GESTOR na UPA, VISUALIZADOR na UEI.

---

## Tabela: units

```
units
- id           UUID PK
- name         string
- type         ENUM (MATRIZ | UNIDADE)
- parent_id    UUID nullable FK → units
- manager_id   FK → users
- is_active    boolean
- created_at   timestamp
```

---

## Segurança Adicional

- Bcrypt cost factor 12 para senhas
- Bloqueio após 5 tentativas de login falhas (desbloqueio manual pelo admin)
- Refresh token armazenado em HttpOnly Cookie
- Rate limiting: 30 req/min no endpoint de login
- Timeout de inatividade: 30 min (frontend redireciona para login)
- Logs de auditoria: toda ação registrada com user_id, timestamp e IP

---

## Checklist de Implementação

- [x] Tabelas `users`, `units`, `user_units` no Prisma schema
- [x] Módulo `AuthModule` no NestJS
- [x] `JwtAuthGuard` implementado
- [x] `RolesGuard` com decorator `@Roles()`
- [x] `UnitScopeGuard` com validação por escopo
- [x] `BaseUnitController` abstrato
- [x] Decorator `@CurrentUser()` para injetar usuário nas rotas
- [x] Endpoint `POST /api/auth/login`
- [x] Endpoint `POST /api/auth/logout`
- [x] Endpoint `POST /api/auth/refresh` — silent refresh via refresh cookie (Redis SHA-256)
- [x] Middleware de timeout de inatividade no frontend — `InactivityGuard` (30min)
- [x] Seletor de unidade no header (usuários MULTI) — header.tsx com dropdown e useUnits hook
- [x] Bloqueio de conta após 5 tentativas falhas (failedLogins/lockedAt); desbloqueio via `PATCH /users/:id/unlock`
- [x] Audit log de login/logout com userId, IP e timestamp
