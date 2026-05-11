export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum AcceptanceStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
}

export enum ImpedimentStatus {
  BLOCKED = 'BLOCKED',
  ATTENTION = 'ATTENTION',
  RESOLVED = 'RESOLVED',
}

export enum BoardOwner {
  GROUP = 'GROUP',
  MACRO_TASK = 'MACRO_TASK',
  PHASE = 'PHASE',
}

export interface KanbanBoard {
  id: string
  name: string
  ownerType: BoardOwner
  ownerId: string
  unitId: string
  columns: KanbanColumn[]
}

export interface KanbanColumn {
  id: string
  boardId: string
  name: string
  position: number
  wipLimit: number | null
  isDoneColumn: boolean
  color: string | null
}

export interface Task {
  id: string
  boardId: string
  columnId: string
  title: string
  description: string | null
  responsibleUserId: string
  priority: Priority
  startDate: string | null
  dueDate: string | null
  position: number
  isBlocked: boolean
  acceptanceStatus: AcceptanceStatus
  unitId: string
}

export interface TaskDependency {
  id: string
  taskId: string
  dependsOnId: string
  dependsOn: { id: string; title: string; columnId: string }
  createdAt: string
}

export interface TaskChecklist {
  id: string
  taskId: string
  description: string
  isDone: boolean
  createdAt: string
}

export interface TaskImpediment {
  id: string
  taskId: string
  reportedBy: string
  description: string
  responsibleForResolution: string
  expectedResolutionDate: string
  status: ImpedimentStatus
  escalationLevel: number
  resolvedAt: string | null
}

export interface TaskFile {
  id: string
  taskId: string
  fileKey: string
  fileName: string
  fileSize: number
  fileMime: string
  uploadedBy: string
  createdAt: string
  url: string
}

export interface TaskMentionSuggestion {
  id: string
  title: string
}
