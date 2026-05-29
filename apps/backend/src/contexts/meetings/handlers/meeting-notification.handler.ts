import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { EventBusService, NotifyManyRequested } from '../../../shared/events'
import { NotificationType } from '@mediall/types'
import { MeetingScheduledEvent } from '../events/meeting-scheduled.event'
import { MeetingReminderDueEvent } from '../events/meeting-reminder-due.event'

@Injectable()
export class MeetingNotificationHandler {
  constructor(private eventBus: EventBusService) {}

  @OnEvent('meeting.scheduled')
  onScheduled(event: MeetingScheduledEvent) {
    if (event.invitedUserIds.length === 0) return

    this.eventBus.publish(
      new NotifyManyRequested(
        event.invitedUserIds.map((userId) => ({
          userId,
          title: 'Nova reunião agendada',
          body: `${event.creatorName} agendou "${event.meetingTitle}"`,
          type: NotificationType.MEETING_REMINDER as any,
          entityType: 'meeting',
          entityId: event.meetingId,
          unitId: event.unitId,
        })),
      ),
    )
  }

  @OnEvent('meeting.reminder_due')
  onReminderDue(event: MeetingReminderDueEvent) {
    if (event.participantUserIds.length === 0) return

    this.eventBus.publish(
      new NotifyManyRequested(
        event.participantUserIds.map((userId) => ({
          userId,
          title: 'Reunião em breve',
          body: `"${event.meetingTitle}" começa em ${event.minutesUntilStart} minutos.`,
          type: NotificationType.MEETING_REMINDER as any,
          entityType: 'meeting',
          entityId: event.meetingId,
          unitId: event.unitId,
        })),
      ),
    )
  }
}
