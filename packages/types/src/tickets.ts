export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface TicketComment {
  id: string
  ticketId: string
  userId: string
  content: string
  isInternal: boolean
  createdAt: string
  updatedAt: string
  user?: { id: string; name: string; avatarUrl: string | null }
}

export interface Ticket {
  id: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: string | null
  unitId: string
  reportedBy: string
  assignedTo: string | null
  resolvedAt: string | null
  closedAt: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
  reporter?: { id: string; name: string; avatarUrl: string | null }
  assignee?: { id: string; name: string; avatarUrl: string | null } | null
  comments?: TicketComment[]
  _count?: { comments: number }
}

export interface CreateTicketDto {
  title: string
  description: string
  priority?: TicketPriority
  category?: string
  assignedTo?: string
  dueDate?: string
}

export interface UpdateTicketDto {
  title?: string
  description?: string
  status?: TicketStatus
  priority?: TicketPriority
  assignedTo?: string
  dueDate?: string
}
