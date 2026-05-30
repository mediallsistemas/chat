'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useUnitStore } from '@/shared/store/unit-store'

export interface AuditLogUser {
  id: string
  name: string
  email: string
}

export interface AuditLog {
  id: string
  userId: string
  unitId: string | null
  action: string
  entityId: string | null
  entityType: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string
  createdAt: string
  user: AuditLogUser
}

export interface AuditLogsResponse {
  logs: AuditLog[]
  total: number
  page: number
  totalPages: number
}

interface AuditLogsFilters {
  page?: number
  limit?: number
  action?: string
  entityType?: string
  userId?: string
}

export function useAuditLogs(filters: AuditLogsFilters = {}) {
  const { activeUnit } = useUnitStore()

  return useQuery({
    queryKey: ['audit-logs', activeUnit?.id, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.page) params.set('page', String(filters.page))
      if (filters.limit) params.set('limit', String(filters.limit))
      if (filters.action) params.set('action', filters.action)
      if (filters.entityType) params.set('entityType', filters.entityType)
      if (filters.userId) params.set('userId', filters.userId)

      const res = await api.get<{ data: AuditLogsResponse }>(
        `/units/${activeUnit!.id}/audit-logs?${params.toString()}`,
      )
      return res.data.data
    },
    enabled: !!activeUnit?.id,
  })
}
