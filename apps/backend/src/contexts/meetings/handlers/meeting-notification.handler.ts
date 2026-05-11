import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { NotificationsService } from '../../notifications/notifications.service'
import { NotificationType } from '@mediall/types'
import { MeetingScheduledEvent } from '../events/meeting-scheduled.event'
import { MeetingReminderDueEvent } from '../events/meeting-reminder-due.event'

@Injectable()
export class MeetingNotificationHandler {
  constructor(private notifications: NotificationsService) {}

  @OnEvent('meeting.scheduled')
  async onScheduled(event: MeetingScheduledEvent) {
    if (event.invitedUserIds.length === 0) return

    await this.notifications.notifyMany(
      event.invitedUserIds.map((userId) => ({
        userId,
        title: 'Nova reunião agendada',
        body: `${event.creatorName} agendou "${event.meetingTitle}"`,
        type: NotificationType.MEETING_REMINDER,
        entityType: 'meeting',
        entityId: event.meetingId,
        unitId: event.unitId,
      })),
    )
  }

  @OnEvent('meeting.reminder_due')
  async onReminderDue(event: MeetingReminderDueEvent) {
    if (event.participantUserIds.length === 0) return

    await this.notifications.notifyMany(
      event.participantUserIds.map((userId) => ({
        userId,
        title: 'Reunião em breve',
        body: `"${event.meetingTitle}" começa em ${event.minutesUntilStart} minutos.`,
        type: NotificationType.MEETING_REMINDER,
        entityType: 'meeting',
        entityId: event.meetingId,
        unitId: event.unitId,
      })),
    )
  }
}
