import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { GroupSystemEventService } from '../groups/group-system-event.service'

/**
 * Bridges meeting domain events into ephemeral system notices shown in the chat
 * group the meeting belongs to (`Meeting.groupId`) — "agenda and minutes in the
 * thread" (Integração 3).
 *
 * Lives in the chat context and only reads other contexts' event payloads, never
 * their services/event classes (architecture.md §1/§3) — hence the structural
 * payload types. A meeting created outside a group is a silent no-op.
 */
interface MeetingScheduledPayload {
  meetingId: string
  meetingTitle: string
  unitId: string
  creatorName: string
}

interface MeetingEndedPayload {
  unitId: string
  payload: { meetingId: string }
}

@Injectable()
export class MeetingToChatHandler {
  constructor(private system: GroupSystemEventService) {}

  @OnEvent('meeting.scheduled')
  async onMeetingScheduled(e: MeetingScheduledPayload) {
    await this.system.emitForMeeting(e.meetingId, e.unitId, {
      tone: 'info',
      icon: 'calendar-event',
      text: `Reunião "${e.meetingTitle}" agendada por ${e.creatorName}.`,
      href: '/reunioes',
    })
  }

  @OnEvent('meeting.ended')
  async onMeetingEnded(e: MeetingEndedPayload) {
    await this.system.emitForMeeting(e.payload.meetingId, e.unitId, {
      tone: 'info',
      icon: 'calendar-check',
      text: 'A reunião foi encerrada. A ata fica disponível em Reuniões.',
      href: '/reunioes',
    })
  }
}
