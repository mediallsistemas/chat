'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { getErrorMessage } from '@/shared/lib/get-error-message'
import { toast } from '@/shared/hooks/use-toast'
import { useAuthStore } from '@/features/auth/store/auth-store'
import type {
  PlanTier,
  PlatformTenantDetail,
  PlatformTenantListItem,
} from '@mediall/types'

/** All tenants (platform-admin only — plano 26.5). */
export function usePlatformTenants() {
  return useQuery<PlatformTenantListItem[]>({
    queryKey: ['platform', 'tenants'],
    queryFn: async () => {
      const res = await api.get<{ data: PlatformTenantListItem[] }>('/platform/tenants')
      return res.data.data
    },
    staleTime: 30_000,
  })
}

export function usePlatformTenant(id: string) {
  return useQuery<PlatformTenantDetail>({
    queryKey: ['platform', 'tenants', id],
    queryFn: async () => {
      const res = await api.get<{ data: PlatformTenantDetail }>(`/platform/tenants/${id}`)
      return res.data.data
    },
    enabled: !!id,
  })
}

export function useSuspendTenant(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(`/platform/tenants/${id}/suspend`, {}).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'tenants'] })
      toast.success('Organização suspensa.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useReactivateTenant(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(`/platform/tenants/${id}/reactivate`, {}).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'tenants'] })
      toast.success('Organização reativada.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useChangeTier(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tier: PlanTier) =>
      api.patch(`/platform/tenants/${id}/tier`, { tier }).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'tenants'] })
      toast.success('Plano atualizado.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

/**
 * Impersonate a tenant admin for support (plano 26.5). The backend swaps the auth
 * cookie; we clear the persisted session and hard-reload so the app re-fetches
 * `/auth/me` as the impersonated user.
 */
export function useImpersonateTenant(id: string) {
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation({
    mutationFn: () =>
      api.post(`/platform/tenants/${id}/impersonate`, {}).then((r) => r.data.data),
    onSuccess: () => {
      setUser(null)
      window.location.href = '/dashboard'
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
