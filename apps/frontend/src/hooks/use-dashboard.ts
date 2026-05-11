'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface DashboardUnit {
  id: string
  name: string
  type: string
  status: 'GREEN' | 'YELLOW' | 'RED'
  progress: number
  plans: number
  impediments: number
}

export interface DashboardPlan {
  id: string
  name: string
  year: number
  unitId: string
  unitName: string
  progress: number
  trafficLight: 'GREEN' | 'YELLOW' | 'RED'
}

export interface DashboardImpediment {
  id: string
  description: string
  unitId: string
  escalationLevel: number
  daysOpen: number
  taskId: string
  taskTitle: string
  responsibleForResolution: string
}

export interface DashboardSummary {
  metrics: {
    totalPlans: number
    openImpediments: number
    blockedTasks: number
    overdueTasks: number
    completedTasks: number
    goalsAtRisk: number
  }
  units: DashboardUnit[]
  plans: DashboardPlan[]
  impediments: DashboardImpediment[]
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await api.get<{ data: DashboardSummary }>('/dashboard/summary')
      return res.data.data
    },
    staleTime: 60_000,
  })
}
