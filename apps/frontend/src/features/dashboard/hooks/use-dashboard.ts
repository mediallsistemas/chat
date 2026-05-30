'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '@/shared/lib/api'
import { getSocket } from '@/shared/lib/socket'

export interface DashboardUnit {
  id: string
  name: string
  type: string
  status: 'GREEN' | 'YELLOW' | 'RED'
  progress: number
  plans: number
  impediments: number
  generalGroupId: string | null
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

export interface StaleTaskAlert {
  taskId: string
  taskTitle: string
  unitId: string
  responsibleUserId: string
  daysStale: number
  dueDate: string | null
  boardName: string
}

export function useDashboard() {
  const qc = useQueryClient()

  useEffect(() => {
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    const handler = () => {
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    }
    socket.on('dashboard:update', handler)
    return () => {
      socket.off('dashboard:update', handler)
    }
  }, [qc])

  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await api.get<{ data: DashboardSummary }>('/dashboard/summary')
      return res.data.data
    },
    staleTime: 60_000,
  })
}

export function useStaleTaskAlerts() {
  return useQuery<StaleTaskAlert[]>({
    queryKey: ['dashboard', 'stale-tasks'],
    queryFn: async () => {
      const res = await api.get<{ data: StaleTaskAlert[] }>('/dashboard/stale-tasks')
      return res.data.data
    },
    staleTime: 120_000,
  })
}
