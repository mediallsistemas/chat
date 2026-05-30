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
  units: string[]
}

export interface LoginResponse {
  user: AuthUser
}
