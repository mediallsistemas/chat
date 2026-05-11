export enum PlanStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum GoalStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  AT_RISK = 'AT_RISK',
  DONE = 'DONE',
}

export enum PhaseStatus {
  LOCKED = 'LOCKED',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum TrafficLight {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED',
}

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
}

export enum CalcMethod {
  SUM = 'SUM',
  PERCENTAGE = 'PERCENTAGE',
  BINARY = 'BINARY',
}

export enum UnitScope {
  ALL = 'ALL',
  SPECIFIC = 'SPECIFIC',
  MATRIX = 'MATRIX',
}

export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  REVIEW = 'REVIEW',
  DONE = 'DONE',
}

export interface Plan {
  id: string
  name: string
  year: number
  vision: string | null
  mission: string | null
  values: string | null
  status: PlanStatus
  unitId: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface Objective {
  id: string
  planId: string
  title: string
  description: string | null
  benefits: string | null
  responsibleUserId: string
  deadline: string
  status: GoalStatus
  progressPct: number
  trafficLight: TrafficLight
  groupId: string | null
  unitId: string
}

export interface Goal {
  id: string
  objectiveId: string
  title: string
  description: string | null
  direction: Direction
  calcMethod: CalcMethod
  targetValue: number | null
  currentValue: number
  initialValue: number
  investment: number | null
  status: GoalStatus
  progressPct: number
  unitId: string
}

export interface PlanPhase {
  id: string
  goalId: string
  title: string
  description: string | null
  order: number
  status: PhaseStatus
  unitScope: UnitScope
  responsibleUserId: string
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
  kanbanBoardId: string
}

export interface MacroTask {
  id: string
  phaseId: string
  goalId: string
  objectiveId: string
  title: string
  description: string | null
  responsibleUserId: string
  sectorId: string | null
  unitId: string
  startDate: string | null
  dueDate: string | null
  status: TaskStatus
  progressPct: number
  groupId: string | null
  kanbanBoardId: string
  kanbanBoard: { id: string; name: string }
  createdAt: string
  updatedAt: string
}
