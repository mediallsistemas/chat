'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useUnitStore } from '@/shared/store/unit-store'
import type { TranscriptResult } from '@mediall/types'

function url(unitId: string, meetingId: string) {
  return `/units/${unitId}/meetings/${meetingId}/transcript`
}

export function useTranscript(meetingId: string) {
  const { activeUnit } = useUnitStore()
  return useQuery({
    queryKey: ['transcript', activeUnit?.id, meetingId],
    queryFn: async () => {
      const res = await api.get<{ data: { transcript: string | null; transcriptSummary: string | null; transcriptActionItems: TranscriptResult | null; transcriptedAt: string | null } }>(
        url(activeUnit!.id, meetingId),
      )
      return res.data.data
    },
    enabled: !!activeUnit?.id && !!meetingId,
  })
}

export function useProcessTranscript(meetingId: string) {
  const { activeUnit } = useUnitStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (transcript: string) => {
      const res = await api.post(url(activeUnit!.id, meetingId), { transcript })
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transcript', activeUnit?.id, meetingId] })
      qc.invalidateQueries({ queryKey: ['meeting', activeUnit?.id, meetingId] })
    },
  })
}
