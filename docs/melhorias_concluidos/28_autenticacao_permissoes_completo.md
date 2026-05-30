---
name: autenticacao-permissoes-completo
description: Módulo 02 — Autenticação e Permissões completamente implementado (JWT, guards, RBAC, refresh token, audit log)
metadata:
  type: project
---

# Plano 02 — Autenticação e Permissões: Concluído

## O que foi implementado

### Backend
- JWT em HttpOnly Cookie (15min access + 7d refresh via Redis com hash SHA-256)
- `POST /auth/login` — valida credenciais, seta cookies, audit log LOGIN
- `POST /auth/logout` — revoga refresh token no Redis, limpa cookies, audit log LOGOUT
- `POST /auth/refresh` — silent refresh via refresh cookie
- `GET /auth/me` + `PATCH /auth/me` — perfil do usuário logado
- Guard stack global: `JwtAuthGuard → RolesGuard → UnitScopeGuard`
- `BaseUnitController` — prefixo `units/:unitId` + guards automáticos para todos os controllers de unidade
- `@CurrentUser()` decorator — injeta JwtPayload nas rotas
- `@Roles()` decorator — restringe por UserRole
- Bloqueio de conta após 5 tentativas falhas (failedLogins/lockedAt); desbloqueio via `PATCH /users/:id/unlock`
- Audit log de login/logout com userId, IP e timestamp
- Rate limiting no login: `@Throttle({ default: { ttl: 60_000, limit: 5 } })`

### Frontend
- `InactivityGuard` — timeout de 30min, chama logout e redireciona para /login
- Interceptor Axios — silent refresh em 401 antes de redirecionar
- `authStore` (Zustand) — usuário logado, setUser, clear
- `unitStore` (Zustand) — unidade ativa, setUnits, switchUnit
- Seletor de unidade no header para usuários MULTI
- AccessScope behavior: GLOBAL (navega livre), MULTI (seletor), SINGLE (entra direto)
