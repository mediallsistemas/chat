'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { toast } from '@/shared/hooks/use-toast'
import { getErrorMessage } from '@/shared/lib/get-error-message'
import type { AccessScope, UserRole } from '@mediall/types'

export interface UserListItem {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  accessScope: AccessScope
  isActive: boolean
  createdAt: string
  lastSeenAt: string | null
  unitAccess: Array<{ unitId: string; role: UserRole; isPrimary: boolean; unit: { name: string } }>
}

interface UsersResponse {
  users: UserListItem[]
  total: number
  page: number
  limit: number
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
  accessScope: AccessScope
  avatarUrl?: string
}

export interface UpdateUserInput {
  name?: string
  avatarUrl?: string
  isActive?: boolean
}

function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return api.get<{ data: T }>(url, { params }).then((r) => r.data.data)
}

function post<T>(url: string, body: unknown): Promise<T> {
  return api.post<{ data: T }>(url, body).then((r) => r.data.data)
}

function patch<T>(url: string, body?: unknown): Promise<T> {
  return api.patch<{ data: T }>(url, body).then((r) => r.data.data)
}

function del<T>(url: string): Promise<T> {
  return api.delete<{ data: T }>(url).then((r) => r.data.data)
}

export function useUsers(params?: { page?: number; limit?: number; search?: string }) {
  return useQuery<UsersResponse>({
    queryKey: ['users', params],
    queryFn: () => get<UsersResponse>('/users', params as Record<string, unknown>),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateUserInput) => post<UserListItem>('/users', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuário criado com sucesso')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useUpdateUser(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateUserInput) => patch<UserListItem>(`/users/${userId}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuário atualizado')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export interface UnitMember {
  id: string
  name: string
  avatarUrl: string | null
  role: UserRole
}

export function useUnitMembers(unitId: string | undefined) {
  return useQuery<UnitMember[]>({
    queryKey: ['units', unitId, 'members'],
    queryFn: () => get<UnitMember[]>(`/units/${unitId}/members`),
    enabled: !!unitId,
  })
}

export function useUnlockUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => patch<{ id: string; name: string }>(`/users/${userId}/unlock`),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(`Conta de ${data.name} desbloqueada`)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export interface AdminUnit {
  id: string
  name: string
}

/** All units the current admin can see — used to assign users to units. */
export function useAllUnits() {
  return useQuery<AdminUnit[]>({
    queryKey: ['units', 'all'],
    queryFn: () => get<AdminUnit[]>('/units'),
  })
}

/** Assign (or update the role of) a user in a unit. */
export function useAssignUserUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ unitId, ...body }: { unitId: string; userId: string; role: UserRole; isPrimary?: boolean }) =>
      post(`/units/${unitId}/users`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuário atribuído à unidade.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

/** Remove a user from a unit. */
export function useRemoveUserUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ unitId, userId }: { unitId: string; userId: string }) =>
      del(`/units/${unitId}/users/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuário removido da unidade.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
