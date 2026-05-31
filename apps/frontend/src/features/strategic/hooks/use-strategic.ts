import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from '@/shared/hooks/use-toast'
import { getErrorMessage } from '@/shared/lib/get-error-message'
import type {
  Plan,
  Objective,
  Goal,
  PlanPhase,
  MacroTask,
  PlanStatus,
  Direction,
  CalcMethod,
  UnitScope,
} from '@mediall/types'

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

// ─── Extended types (with includes) ──────────────────────────────────────────

export interface GoalWithPhases extends Goal {
  phases: Pick<
    PlanPhase,
    'id' | 'title' | 'description' | 'status' | 'order' | 'kanbanBoardId' |
    'responsibleUserId' | 'unitScope' | 'startDate' | 'dueDate'
  >[]
}

export interface ObjectiveWithGoals extends Objective {
  goals: Pick<Goal, 'id' | 'title' | 'progressPct' | 'status'>[]
}

export interface PlanWithObjectiveCount extends Plan {
  _count: { objectives: number }
}

// ─── Strategic Panel ─────────────────────────────────────────────────────────

export interface StrategicPanelData {
  activePlansCount: number
  totalObjectives: number
  doneObjectives: number
  activePhasesCount: number
  blockedMacroTasks: number
  atRiskGoals: number
  overduePhases: number
  plans: Array<{
    id: string
    name: string
    year: number
    status: string
    objectives: Array<{
      id: string
      title: string
      progressPct: number
      trafficLight: string
      status: string
      goals: Array<{
        id: string
        title: string
        progressPct: number
        status: string
        phases: Array<{ id: string; title: string; status: string; dueDate: string | null; _count: { macroTasks: number } }>
      }>
    }>
  }>
}

export function useStrategicPanel(unitId: string | undefined) {
  return useQuery<StrategicPanelData>({
    queryKey: ['strategic-panel', unitId],
    queryFn: () => get<StrategicPanelData>(`/units/${unitId}/plans/panel`),
    enabled: !!unitId,
    staleTime: 30_000,
  })
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export function usePlans(unitId: string | undefined) {
  return useQuery<PlanWithObjectiveCount[]>({
    queryKey: ['plans', unitId],
    queryFn: () => get<PlanWithObjectiveCount[]>(`/units/${unitId}/plans`),
    enabled: !!unitId,
  })
}

export function usePlanDetail(unitId: string | undefined, planId: string | undefined) {
  return useQuery<Plan & { objectives: ObjectiveWithGoals[] }>({
    queryKey: ['plans', unitId, planId],
    queryFn: () =>
      get<Plan & { objectives: ObjectiveWithGoals[] }>(`/units/${unitId}/plans/${planId}`),
    enabled: !!unitId && !!planId,
  })
}

export function usePlanUnit(planId: string | undefined) {
  return useQuery<{ unitId: string }>({
    queryKey: ['plan-unit', planId],
    queryFn: () => get<{ unitId: string }>(`/plans/${planId}/unit`),
    enabled: !!planId,
    staleTime: Infinity,
  })
}

// ─── Objectives ───────────────────────────────────────────────────────────────

export function useObjectives(unitId: string | undefined, planId: string | undefined) {
  return useQuery<ObjectiveWithGoals[]>({
    queryKey: ['objectives', unitId, planId],
    queryFn: () =>
      get<ObjectiveWithGoals[]>(`/units/${unitId}/plans/${planId}/objectives`),
    enabled: !!unitId && !!planId,
  })
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export function useGoals(
  unitId: string | undefined,
  objectiveId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery<GoalWithPhases[]>({
    queryKey: ['goals', unitId, objectiveId],
    queryFn: () =>
      get<GoalWithPhases[]>(`/units/${unitId}/objectives/${objectiveId}/goals`),
    enabled: (options?.enabled ?? true) && !!unitId && !!objectiveId,
  })
}

// ─── Create mutations ─────────────────────────────────────────────────────────

export interface CreatePlanInput {
  name: string
  year: number
  status?: PlanStatus
  vision?: string
  mission?: string
  values?: string
}

export function useCreatePlan(unitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreatePlanInput) => post<Plan>(`/units/${unitId}/plans`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans', unitId] })
      toast.success('Plano criado com sucesso')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export interface CreateObjectiveInput {
  title: string
  description?: string
  benefits?: string
  responsibleUserId: string
  responsibleSectorId?: string
  deadline: string
  groupId?: string
}

export function useCreateObjective(unitId: string, planId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateObjectiveInput) =>
      post<Objective>(`/units/${unitId}/plans/${planId}/objectives`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['objectives', unitId, planId] })
      qc.invalidateQueries({ queryKey: ['plans', unitId, planId] })
      toast.success('Objetivo criado')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export interface CreateGoalInput {
  title: string
  description?: string
  direction: Direction
  calcMethod: CalcMethod
  targetValue?: number
  initialValue?: number
  investment?: number
  sectorId?: string
}

export function useCreateGoal(unitId: string, objectiveId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateGoalInput) =>
      post<Goal>(`/units/${unitId}/objectives/${objectiveId}/goals`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals', unitId, objectiveId] })
      qc.invalidateQueries({ queryKey: ['objectives', unitId] })
      toast.success('Meta criada')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export interface CreatePhaseInput {
  title: string
  description?: string
  order: number
  responsibleUserId: string
  unitScope?: UnitScope
  startDate?: string
  dueDate?: string
}

export function useCreatePhase(unitId: string, goalId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreatePhaseInput) =>
      post<PlanPhase>(`/units/${unitId}/goals/${goalId}/phases`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals', unitId] })
      toast.success('Etapa criada')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export interface PhaseScopeProgress {
  unitId: string
  unitName: string
  kanbanBoardId: string
  total: number
  completed: number
  progressPct: number
}

export function usePhaseScopeProgress(unitId: string | undefined, goalId: string | undefined, phaseId: string | undefined) {
  return useQuery<PhaseScopeProgress[]>({
    queryKey: ['phase-scope-progress', phaseId],
    queryFn: () => get<PhaseScopeProgress[]>(`/units/${unitId}/goals/${goalId}/phases/${phaseId}/scope-progress`),
    enabled: !!unitId && !!goalId && !!phaseId,
    staleTime: 15_000,
  })
}

export function useCompletePhase(unitId: string, goalId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (phaseId: string) =>
      patch<PlanPhase>(`/units/${unitId}/goals/${goalId}/phases/${phaseId}/complete`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals', unitId] })
      qc.invalidateQueries({ queryKey: ['objectives', unitId] })
      qc.invalidateQueries({ queryKey: ['plans', unitId] })
      toast.success('Etapa concluída')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export interface UpdatePlanInput extends Partial<CreatePlanInput> {}

export function useUpdatePlan(unitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, dto }: { planId: string; dto: UpdatePlanInput }) =>
      patch<Plan>(`/units/${unitId}/plans/${planId}`, dto),
    onSuccess: (_data, { planId }) => {
      qc.invalidateQueries({ queryKey: ['plans', unitId] })
      qc.invalidateQueries({ queryKey: ['plans', unitId, planId] })
      toast.success('Plano atualizado')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export interface UpdateObjectiveInput extends Partial<CreateObjectiveInput> {}

export function useUpdateObjective(unitId: string, planId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ objectiveId, dto }: { objectiveId: string; dto: UpdateObjectiveInput }) =>
      patch<Objective>(`/units/${unitId}/plans/${planId}/objectives/${objectiveId}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['objectives', unitId, planId] })
      toast.success('Objetivo atualizado')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export interface UpdateGoalInput extends Partial<CreateGoalInput> {}

export function useUpdateGoal(unitId: string, objectiveId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ goalId, dto }: { goalId: string; dto: UpdateGoalInput }) =>
      patch<Goal>(`/units/${unitId}/objectives/${objectiveId}/goals/${goalId}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals', unitId, objectiveId] })
      toast.success('Meta atualizada')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export interface UpdatePhaseInput extends Partial<CreatePhaseInput> {}

export function useUpdatePhase(unitId: string, goalId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ phaseId, dto }: { phaseId: string; dto: UpdatePhaseInput }) =>
      patch<PlanPhase>(`/units/${unitId}/goals/${goalId}/phases/${phaseId}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals', unitId] })
      toast.success('Etapa atualizada')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useActivatePlan(unitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) =>
      patch<Plan>(`/units/${unitId}/plans/${planId}/activate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans', unitId] })
      toast.success('Plano ativado')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useArchivePlan(unitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) =>
      patch<Plan>(`/units/${unitId}/plans/${planId}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans', unitId] })
      toast.success('Plano arquivado')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ─── Macro Tasks ──────────────────────────────────────────────────────────────

export function useMacroTasks(unitId: string | undefined, phaseId: string | undefined) {
  return useQuery<MacroTask[]>({
    queryKey: ['macro-tasks', unitId, phaseId],
    queryFn: () => get<MacroTask[]>(`/units/${unitId}/phases/${phaseId}/macro-tasks`),
    enabled: !!unitId && !!phaseId,
  })
}

export interface CreateMacroTaskInput {
  title: string
  description?: string
  responsibleUserId: string
  sectorId?: string
  startDate?: string
  dueDate?: string
  groupId?: string
}

export function useCreateMacroTask(unitId: string, phaseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateMacroTaskInput) =>
      post<MacroTask>(`/units/${unitId}/phases/${phaseId}/macro-tasks`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['macro-tasks', unitId, phaseId] })
      toast.success('Macro tarefa criada')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
