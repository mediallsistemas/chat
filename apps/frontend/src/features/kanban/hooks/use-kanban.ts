import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from '@/shared/hooks/use-toast'
import { getErrorMessage } from '@/shared/lib/get-error-message'
import type { Priority, AcceptanceStatus, TaskChecklist, TaskDependency } from '@mediall/types'

// ─── API wrapper ──────────────────────────────────────────────────────────────

function get<T>(url: string): Promise<T> {
  return api.get<{ data: T }>(url).then((r) => r.data.data)
}

function post<T>(url: string, body: unknown): Promise<T> {
  return api.post<{ data: T }>(url, body).then((r) => r.data.data)
}

function patch<T>(url: string, body?: unknown): Promise<T> {
  return api.patch<{ data: T }>(url, body).then((r) => r.data.data)
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KanbanTaskItem {
  id: string
  title: string
  description: string | null
  responsibleUserId: string
  priority: Priority
  startDate: string | null
  dueDate: string | null
  position: number
  isBlocked: boolean
  acceptanceStatus: AcceptanceStatus
  _count: { impediments: number; checklists: number }
}

export interface KanbanColumnItem {
  id: string
  name: string
  position: number
  wipLimit: number | null
  isDoneColumn: boolean
  color: string | null
  tasks: KanbanTaskItem[]
}

export interface KanbanBoardData {
  id: string
  name: string
  ownerType: string
  ownerId: string
  unitId: string
  columns: KanbanColumnItem[]
}

export interface CreateTaskInput {
  boardId: string
  columnId: string
  title: string
  responsibleUserId: string
  description?: string
  priority?: Priority
  startDate?: string
  dueDate?: string
  estimatedHours?: number
  macroTaskId?: string
}

export interface MoveTaskInput {
  columnId: string
  position: number
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useKanbanBoard(unitId: string | undefined, boardId: string | undefined) {
  return useQuery<KanbanBoardData>({
    queryKey: ['kanban', unitId, boardId],
    queryFn: () => get<KanbanBoardData>(`/units/${unitId}/kanban/${boardId}`),
    enabled: !!unitId && !!boardId,
  })
}

export function useCreateTask(unitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateTaskInput) => post<KanbanTaskItem>(`/units/${unitId}/tasks`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', unitId] })
      toast.success('Tarefa criada')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useMoveTask(unitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, dto }: { taskId: string; dto: MoveTaskInput }) =>
      patch<KanbanTaskItem>(`/units/${unitId}/tasks/${taskId}/move`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', unitId] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useAcceptTask(unitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      patch<KanbanTaskItem>(`/units/${unitId}/tasks/${taskId}/accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', unitId] })
      toast.success('Tarefa aceita')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useDeclineTask(unitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      patch<KanbanTaskItem>(`/units/${unitId}/tasks/${taskId}/decline`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', unitId] })
      toast.success('Tarefa recusada')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export interface TaskDetail extends KanbanTaskItem {
  checklists: TaskChecklist[]
  dependencies: TaskDependency[]
  createdAt: string
  completedAt: string | null
}

export function useTaskDetail(unitId: string | undefined, taskId: string | undefined) {
  return useQuery<TaskDetail>({
    queryKey: ['task', unitId, taskId],
    queryFn: () => get<TaskDetail>(`/units/${unitId}/tasks/${taskId}`),
    enabled: !!unitId && !!taskId,
  })
}

export function useAddChecklistItem(unitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, description }: { taskId: string; description: string }) =>
      post<TaskChecklist>(`/units/${unitId}/tasks/${taskId}/checklists`, { description }),
    onSuccess: (_, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['task', unitId, taskId] })
      qc.invalidateQueries({ queryKey: ['kanban', unitId] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useToggleChecklistItem(unitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, checklistId }: { taskId: string; checklistId: string }) =>
      patch<TaskChecklist>(`/units/${unitId}/tasks/${taskId}/checklists/${checklistId}/toggle`),
    onSuccess: (_, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['task', unitId, taskId] })
      qc.invalidateQueries({ queryKey: ['kanban', unitId] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useDeleteChecklistItem(unitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, checklistId }: { taskId: string; checklistId: string }) =>
      api.delete(`/units/${unitId}/tasks/${taskId}/checklists/${checklistId}`),
    onSuccess: (_, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['task', unitId, taskId] })
      qc.invalidateQueries({ queryKey: ['kanban', unitId] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useAddDependency(unitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) =>
      post<TaskDependency>(`/units/${unitId}/tasks/${taskId}/dependencies`, { dependsOnId }),
    onSuccess: (_, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['task', unitId, taskId] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useRemoveDependency(unitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) =>
      api.delete(`/units/${unitId}/tasks/${taskId}/dependencies/${dependsOnId}`),
    onSuccess: (_, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['task', unitId, taskId] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
