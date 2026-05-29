import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { NotificationsService } from '../notifications.service'
import { NotifyUserRequested, NotifyManyRequested } from '../../../shared/events'

@Injectable()
export class NotifyUserRequestedHandler {
  private readonly logger = new Logger(NotifyUserRequestedHandler.name)

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent('notification.notify_user.requested', { async: true })
  async onNotifyUser(event: NotifyUserRequested) {
    try {
      await this.notifications.create(event.payload as any)
    } catch (err) {
      this.logger.error(`Failed to deliver notification for user ${event.payload.userId}`, err instanceof Error ? err.stack : String(err))
    }
  }

  @OnEvent('notification.notify_many.requested', { async: true })
  async onNotifyMany(event: NotifyManyRequested) {
    try {
      await this.notifications.notifyMany(event.payloads as any)
    } catch (err) {
      this.logger.error(`Failed to deliver batch notification`, err instanceof Error ? err.stack : String(err))
    }
  }
}
