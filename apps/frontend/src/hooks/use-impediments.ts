'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useUnitStore } from '@/store/unit-store'
import { toast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/get-error-message'
import type { ImpedimentStatus, TaskImpediment } from '@mediall/types'

export interface ImpedimentWithTask extends TaskImpediment {
  task: { id: string; title: string; boardId: string }
  unitId: string
  createdAt: string
  resolvedBy: string | null
  resolutionNotes: string | null
}

export interface ImpedimentAnalytics {
  blocked: number
  attention: number
  resolvedLast30: number
  avgResolutionHours: number
  byEscalationLevel: { level: number; count: number }[]
  topAssignees: { id: string; name: string; avatarUrl: string | null; count: number }[]
}

export function useImpediments() {
  const activeUnit = useUnitStore((s) => s.activeUnit)

  return useQuery({
    queryKey: ['impediments', activeUnit?.id],
    queryFn: async () => {
      const res = await api.get<{ data: ImpedimentWithTask[] }>(
        `/units/${activeUnit!.id}/impediments`,
      )
      return res.data.data
    },
    enabled: !!activeUnit,
  })
}

export function useImpedimentAnalytics() {
  const activeUnit = useUnitStore((s) => s.activeUnit)

  return useQuery({
    queryKey: ['impediments', activeUnit?.id, 'analytics'],
    queryFn: async () => {
      const res = await api.get<{ data: ImpedimentAnalytics }>(
        `/units/${activeUnit!.id}/impediments/analytics`,
      )
      return res.data.data
    },
    enabled: !!activeUnit,
  })
}

export function useResolveImpediment() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      impedimentId,
      resolutionNotes,
    }: {
      impedimentId: string
      resolutionNotes: string
    }) =>
      api.patch(`/units/${activeUnit!.id}/impediments/${impedimentId}/resolve`, {
        resolutionNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impediments', activeUnit?.id] })
      toast.success('Impedimento resolvido')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useCreateImpediment() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      taskId,
      description,
      responsibleForResolution,
      expectedResolutionDate,
      status,
    }: {
      taskId: string
      description: string
      responsibleForResolution: string
      expectedResolutionDate: string
      status?: ImpedimentStatus
    }) =>
      api.post(`/units/${activeUnit!.id}/tasks/${taskId}/impediments`, {
        description,
        responsibleForResolution,
        expectedResolutionDate,
        status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impediments', activeUnit?.id] })
      toast.success('Impedimento registrado')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
