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
  /** Unidades onde o plano vale (plano 24/25) — breakdown por unidade. */
  attachedUnits: { id: string; name: string }[]
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

/** Group collaboration activity per unit over the last 7 days (plano 22.6). */
export interface DashboardGroupActivity {
  unitId: string
  unitName: string
  activeGroups: number
  messages: number
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
  groupActivity: DashboardGroupActivity[]
}

/** Time-series for the dashboard charts (plano 25 — Slice 2/3). Arrays are aligned to `weeks`. */
export interface DashboardTrends {
  /** Week-start dates (ISO, Mondays), oldest first. */
  weeks: string[]
  completion: number[]
  impedimentsOpened: number[]
  impedimentsResolved: number[]
  /** Plan-progress evolution from daily snapshots (empty until snapshots accumulate). */
  planProgress: { date: string; avgProgress: number }[]
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

    // Coalesce bursts of dashboard:update into a single refetch (plano 25.6).
    let timer: ReturnType<typeof setTimeout> | null = null
    const handler = () => {
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        qc.invalidateQueries({ queryKey: ['dashboard'] })
      }, 800)
    }
    socket.on('dashboard:update', handler)
    return () => {
      socket.off('dashboard:update', handler)
      if (timer) clearTimeout(timer)
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

/**
 * Dashboard time-series. Pass `unitId` to narrow the series to a single unit
 * (header "uma unidade" scope); omit it for the consolidated holding view.
 */
export function useDashboardTrends(unitId?: string) {
  return useQuery<DashboardTrends>({
    queryKey: ['dashboard', 'trends', unitId ?? 'all'],
    queryFn: async () => {
      const res = await api.get<{ data: DashboardTrends }>('/dashboard/trends', {
        params: unitId ? { unitId } : undefined,
      })
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
