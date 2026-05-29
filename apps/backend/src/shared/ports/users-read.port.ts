export const USERS_READ_PORT = Symbol('USERS_READ_PORT')

export interface UserSnapshot {
  id: string
  name: string
  email: string
  isActive: boolean
  avatarUrl: string | null
}

export interface UsersReadPort {
  getById(userId: string): Promise<UserSnapshot | null>
  getByIds(userIds: string[]): Promise<UserSnapshot[]>
  getEmail(userId: string): Promise<{ name: string; email: string } | null>
}
