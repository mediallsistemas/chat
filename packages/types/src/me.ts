// Aggregated payload for the colaborador "Minha visão" page.
// All entities are projected — only the fields the dashboard renders —
// to keep the response small for mobile.

import type { Priority, AcceptanceStatus, ImpedimentStatus } from './kanban'
import type { GroupType } from './chat'

export interface MyTask {
  id: string
  title: string
  description: string | null
  boardId: string
  columnId: string
  priority: Priority
  dueDate: string | null
  isBlocked: boolean
  acceptanceStatus: AcceptanceStatus
  completedAt: string | null
  column: { id: string; name: string; isDoneColumn: boolean }
  board: { id: string; name: string }
}

export interface MyImpediment {
  id: string
  taskId: string
  description: string
  status: ImpedimentStatus
  escalationLevel: number
  expectedResolutionDate: string
  createdAt: string
  task: { id: string; title: string }
}

export interface MyMeeting {
  id: string
  title: string
  startAt: string
  endAt: string
  roomId: string
}

export interface MyUnreadGroup {
  group: {
    id: string
    name: string
    type: GroupType
    avatarUrl: string | null
  }
  unreadCount: number
  lastMessage: {
    id: string
    content: string
    createdAt: string
    sender: { id: string; name: string }
  }
}

export interface MyDashboard {
  todayTasks: MyTask[]
  weekTasks: MyTask[]
  myImpediments: MyImpediment[]
  upcomingMeetings: MyMeeting[]
  unreadGroups: MyUnreadGroup[]
}
