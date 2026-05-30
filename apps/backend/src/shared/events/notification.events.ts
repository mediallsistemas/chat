import { DomainEvent } from './domain-event.base'
import type { NotificationType } from '@prisma/client'

export interface NotifyUserPayload {
  userId: string
  unitId?: string
  type: NotificationType
  title: string
  body: string
  link?: string
  entityType?: string
  entityId?: string
}

export class NotifyUserRequested extends DomainEvent {
  readonly eventName = 'notification.notify_user.requested'
  constructor(public readonly payload: NotifyUserPayload) {
    super()
  }
}

export class NotifyManyRequested extends DomainEvent {
  readonly eventName = 'notification.notify_many.requested'
  constructor(public readonly payloads: NotifyUserPayload[]) {
    super()
  }
}
