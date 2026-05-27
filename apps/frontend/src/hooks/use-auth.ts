'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import { AuthUser, UserStatus } from '@mediall/types'

export function useAuth() {
  const { user, setUser } = useAuthStore()

  const { isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await api.get<{ data: AuthUser }>('/auth/me')
      setUser(res.data.data)
      return res.data.data
    },
    enabled: !user,
    retry: false,
  })

  return { user, isLoading, isAuthenticated: !!user }
}

export function useUpdateStatus() {
  const { user, setUser } = useAuthStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dto: Partial<UserStatus>) => {
      const res = await api.patch<{ data: UserStatus }>('/users/me/status', dto)
      return res.data.data
    },
    onSuccess: (data) => {
      if (user) setUser({ ...user, ...data })
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}
