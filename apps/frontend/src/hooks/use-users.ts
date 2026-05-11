'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/get-error-message'
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
