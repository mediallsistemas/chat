export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  DIRETORIA = 'DIRETORIA',
  GESTOR = 'GESTOR',
  COLABORADOR = 'COLABORADOR',
  VISUALIZADOR = 'VISUALIZADOR',
}

export enum AccessScope {
  GLOBAL = 'GLOBAL',
  MULTI = 'MULTI',
  SINGLE = 'SINGLE',
}

export interface JwtPayload {
  sub: string
  email: string
  name: string
  role: UserRole
  accessScope: AccessScope
  /** Tenant (SaaS customer) the user belongs to — multitenancy plano 23.2. */
  tenantId: string
  /** Tenant slug (subdomain) — used for the host check — multitenancy plano 23.4. */
  tenantSlug: string
  /** SaaS owner — operates across all tenants (plano 26.5). UI hint only; the
   *  PlatformAdminGuard re-checks against the DB (token can't self-elevate). */
  isPlatformAdmin?: boolean
  units: string[]
  iat?: number
  exp?: number
}

export interface UserStatus {
  customStatus: string | null
  customStatusEmoji: string | null
  statusExpiresAt: string | null
}

export interface AuthUser extends UserStatus {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: UserRole
  accessScope: AccessScope
  /** SaaS owner — shows the platform-admin entry in the UI (plano 26.5). */
  isPlatformAdmin?: boolean
  units: string[]
}

export interface LoginResponse {
  user: AuthUser
}
