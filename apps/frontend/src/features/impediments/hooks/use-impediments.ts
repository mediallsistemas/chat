'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useUnitStore } from '@/shared/store/unit-store'
import { toast } from '@/shared/hooks/use-toast'
import { getErrorMessage } from '@/shared/lib/get-error-message'
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
  resolvedThisWeek: number
  avgResolutionHours: number
  avgResolutionDays: number
  byEscalationLevel: { level: number; count: number }[]
  topAssignees: { id: string; name: string; avatarUrl: string | null; count: number }[]
  bySector: { sectorName: string; total: number; avgResolutionDays: number | null }[]
  recurring: { taskId: string; taskTitle: string; count: number }[]
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

export function useEscalationConfig() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const queryClient = useQueryClient()

  const { data: config } = useQuery({
    queryKey: ['impediments', activeUnit?.id, 'escalation-config'],
    queryFn: async () => {
      const res = await api.get<{ data: { id: string; escalationDaysLevel1: number; escalationDaysLevel2: number } }>(
        `/units/${activeUnit!.id}/impediments/escalation-config`,
      )
      return res.data.data
    },
    enabled: !!activeUnit,
  })

  const { mutate: updateConfig, isPending: savingConfig } = useMutation({
    mutationFn: ({ daysLevel1, daysLevel2 }: { daysLevel1: number; daysLevel2: number }) =>
      api.patch(`/units/${activeUnit!.id}/impediments/escalation-config`, { daysLevel1, daysLevel2 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impediments', activeUnit?.id, 'escalation-config'] })
      toast.success('Configuração de escalonamento salva')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return { config, updateConfig, savingConfig }
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
