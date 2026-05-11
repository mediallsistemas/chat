export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_OVERDUE = 'TASK_OVERDUE',
  TASK_DUE_SOON = 'TASK_DUE_SOON',
  IMPEDIMENT_CREATED = 'IMPEDIMENT_CREATED',
  IMPEDIMENT_ESCALATED = 'IMPEDIMENT_ESCALATED',
  IMPEDIMENT_RESOLVED = 'IMPEDIMENT_RESOLVED',
  PHASE_UNLOCKED = 'PHASE_UNLOCKED',
  PHASE_COMPLETED = 'PHASE_COMPLETED',
  MENTION = 'MENTION',
  MEETING_REMINDER = 'MEETING_REMINDER',
  CHECKIN_REQUEST = 'CHECKIN_REQUEST',
  GOAL_AT_RISK = 'GOAL_AT_RISK',
  TRANSCRIPT_READY = 'TRANSCRIPT_READY',
  TICKET_ASSIGNED = 'TICKET_ASSIGNED',
  TICKET_UPDATED = 'TICKET_UPDATED',
}

export interface Notification {
  id: string
  userId: string
  title: string
  body: string
  type: NotificationType
  entityType: string | null
  entityId: string | null
  unitId: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}

export interface NotificationSetting {
  id: string
  userId: string
  dndEnabled: boolean
  dndStart: string | null
  dndEnd: string | null
  emailEnabled: boolean
  emailTypes: NotificationType[]
  pushEnabled: boolean
}

export interface PushSubscriptionPayload {
  endpoint: string
  p256dh: string
  auth: string
}
