'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useUnitStore } from '@/shared/store/unit-store'
import type { Unit } from '@mediall/types'

export function useUnits() {
  const { activeUnit, units, scope, setActiveUnit, enterHoldingScope, setUnits } = useUnitStore()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const res = await api.get<{ data: Unit[] }>('/units')
      return res.data.data
    },
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!data) return
    setUnits(data)
    // Auto-select a default unit only in unit scope. In holding scope ('ALL') the
    // user deliberately cleared the active unit — don't fight that choice.
    if (scope === 'UNIT' && !activeUnit && data.length > 0) {
      const matriz = data.find((u) => u.type === 'MATRIZ')
      setActiveUnit(matriz ?? data[0])
    }
  }, [data, activeUnit, scope, setActiveUnit, setUnits])

  function switchUnit(unit: Unit) {
    setActiveUnit(unit)
    // Invalidate all unit-scoped queries so they re-fetch with the new unitId
    queryClient.invalidateQueries()
  }

  function switchToHolding() {
    enterHoldingScope()
    queryClient.invalidateQueries()
  }

  return { units: data ?? units, activeUnit, scope, switchUnit, switchToHolding, isLoading }
}
