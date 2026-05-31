'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useUnitStore } from '@/store/unit-store'
import type { Unit } from '@mediall/types'

export function useUnits() {
  const { activeUnit, units, setActiveUnit, setUnits } = useUnitStore()
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
    if (!activeUnit && data.length > 0) {
      const matriz = data.find((u) => u.type === 'MATRIZ')
      setActiveUnit(matriz ?? data[0])
    }
  }, [data, activeUnit, setActiveUnit, setUnits])

  function switchUnit(unit: Unit) {
    setActiveUnit(unit)
    // Invalidate all unit-scoped queries so they re-fetch with the new unitId
    queryClient.invalidateQueries()
  }

  return { units: data ?? units, activeUnit, switchUnit, isLoading }
}
