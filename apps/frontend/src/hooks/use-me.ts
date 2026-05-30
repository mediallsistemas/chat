'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useUnitStore } from '@/store/unit-store'
import type { MyDashboard } from '@mediall/types'

export function useMyDashboard() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  return useQuery<MyDashboard>({
    queryKey: ['my-dashboard', activeUnit?.id],
    queryFn: async () => {
      const res = await api.get<{ data: MyDashboard }>(
        `/units/${activeUnit!.id}/me/dashboard`,
      )
      return res.data.data
    },
    enabled: !!activeUnit,
    // Mobile-first: avoid hammering on every focus.
    staleTime: 30_000,
  })
}

/**
 * Wrapper around the existing task move endpoint that invalidates the
 * dashboard cache after a successful move. Used by the task status modal.
 */
export function useMoveMyTask() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string; columnId: string; position?: number }) => {
      return api.patch(`/units/${activeUnit!.id}/tasks/${input.taskId}/move`, {
        columnId: input.columnId,
        position: input.position ?? 0,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-dashboard', activeUnit?.id] })
    },
  })
}

/**
 * Returns the columns of a board so we can render a status picker in the
 * task modal without preloading the entire board.
 */
export interface BoardColumn {
  id: string
  name: string
  isDoneColumn: boolean
  position: number
}

export function useBoardColumns(boardId: string | null) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  return useQuery<BoardColumn[]>({
    queryKey: ['board-columns', activeUnit?.id, boardId],
    queryFn: async () => {
      const res = await api.get<{ data: { columns: BoardColumn[] } }>(
        `/units/${activeUnit!.id}/kanban/${boardId}`,
      )
      return (res.data.data.columns ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        isDoneColumn: c.isDoneColumn,
        position: c.position,
      }))
    },
    enabled: !!activeUnit && !!boardId,
    staleTime: 60_000,
  })
}
