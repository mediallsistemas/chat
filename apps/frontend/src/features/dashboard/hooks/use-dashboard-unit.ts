'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'

export interface UnitDetailObjective {
  id: string
  title: string
  progressPct: number
  trafficLight: 'GREEN' | 'YELLOW' | 'RED'
}

export interface UnitDetailPlan {
  id: string
  name: string
  year: number
  progress: number
  trafficLight: 'GREEN' | 'YELLOW' | 'RED'
  objectives: UnitDetailObjective[]
}

export interface UnitDetailImpediment {
  id: string
  description: string
  escalationLevel: number
  daysOpen: number
  taskId: string
  taskTitle: string
}

export interface UnitDetail {
  unit: { id: string; name: string; type: string; manager: { id: string; name: string } | null }
  plans: UnitDetailPlan[]
  impediments: UnitDetailImpediment[]
  metrics: {
    totalTasks: number
    overdueTasks: number
    openImpediments: number
    activePlans: number
  }
}

export function useDashboardUnit(unitId: string) {
  return useQuery({
    queryKey: ['dashboard', 'unit', unitId],
    queryFn: async () => {
      const res = await api.get<{ data: UnitDetail }>(`/dashboard/units/${unitId}`)
      return res.data.data
    },
    staleTime: 60_000,
  })
}
