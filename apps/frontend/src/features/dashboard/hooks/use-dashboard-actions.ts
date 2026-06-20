'use client'

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { toast } from '@/shared/hooks/use-toast'
import { getErrorMessage } from '@/shared/lib/get-error-message'

/**
 * Inline actions for the Jarvis panel (plano 25.5).
 *
 * Unlike the unit-scoped feature hooks (which read `unitId` from the active
 * unit store), these take `unitId` per call: the holding panel spans several
 * units and may run with no active unit (`scope === 'ALL'`). Each item on the
 * panel carries its own `unitId`, which is what we act on. RBAC is enforced by
 * the backend guard stack — the UI only hides controls the role can't use.
 */

function invalidatePanel(qc: QueryClient, unitId: string) {
  // Refresh the aggregated summary, the unit cockpit, and the unit's lists.
  qc.invalidateQueries({ queryKey: ['dashboard'] })
  qc.invalidateQueries({ queryKey: ['impediments', unitId] })
  qc.invalidateQueries({ queryKey: ['plans', unitId] })
}

export function useResolveImpedimentAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      unitId,
      impedimentId,
      resolutionNotes,
    }: {
      unitId: string
      impedimentId: string
      resolutionNotes: string
    }) => api.patch(`/units/${unitId}/impediments/${impedimentId}/resolve`, { resolutionNotes }),
    onSuccess: (_data, { unitId }) => {
      invalidatePanel(qc, unitId)
      toast.success('Impedimento resolvido.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useArchivePlanAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ unitId, planId }: { unitId: string; planId: string }) =>
      api.patch(`/units/${unitId}/plans/${planId}/archive`),
    onSuccess: (_data, { unitId }) => {
      invalidatePanel(qc, unitId)
      toast.success('Plano arquivado.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

/**
 * Excluir plano (geral) — rota tenant-scoped `DELETE /plans/:planId` (soft-delete,
 * plano 24.2). Não precisa de unitId: remove o plano de todas as unidades.
 */
export function useDeletePlanAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ planId }: { planId: string }) => api.delete(`/plans/${planId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['plans'] })
      qc.invalidateQueries({ queryKey: ['plan-units'] })
      toast.success('Plano excluído.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
