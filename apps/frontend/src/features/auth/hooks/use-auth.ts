'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { AuthUser } from '@mediall/types'

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
