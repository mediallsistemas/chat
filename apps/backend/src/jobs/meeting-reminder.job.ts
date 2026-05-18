import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { MeetingsService } from '../contexts/meetings/meetings.service'
import { EventBusService } from '../shared/events'
import { MeetingReminderDueEvent } from '../contexts/meetings/events/meeting-reminder-due.event'

const MINUTES = 60_000

@Injectable()
export class MeetingReminderJob {
  private readonly logger = new Logger(MeetingReminderJob.name)

  constructor(
    private meetingsService: MeetingsService,
    private eventBus: EventBusService,
  ) {}

  @Cron('*/15 * * * *')
  async sendReminders() {
    this.logger.log('Meeting reminder job started')
    try {
      const now = new Date()
      await Promise.all([this.send24hReminders(now), this.send15minReminders(now)])
      this.logger.log('Meeting reminder job completed')
    } catch (err) {
      this.logger.error('Meeting reminder job failed', (err as Error).stack)
    }
  }

  private async send24hReminders(now: Date) {
    const target = new Date(now.getTime() + 24 * 60 * MINUTES)
    const from = new Date(target.getTime() - 7 * MINUTES)
    const to = new Date(target.getTime() + 7 * MINUTES)

    const meetings = await this.meetingsService.getMeetingsStartingBetween(from, to)
    for (const meeting of meetings) {
      if (meeting.participants.length === 0) continue
      this.eventBus.publish(
        new MeetingReminderDueEvent(
          meeting.id,
          meeting.title,
          meeting.unitId,
          meeting.participants.map((p) => p.userId),
          24 * 60,
        ),
      )
    }
  }

  private async send15minReminders(now: Date) {
    const target = new Date(now.getTime() + 15 * MINUTES)
    const from = new Date(target.getTime() - 2 * MINUTES)
    const to = new Date(target.getTime() + 2 * MINUTES)

    const meetings = await this.meetingsService.getMeetingsStartingBetween(from, to)
    for (const meeting of meetings) {
      if (meeting.participants.length === 0) continue
      this.eventBus.publish(
        new MeetingReminderDueEvent(
          meeting.id,
          meeting.title,
          meeting.unitId,
          meeting.participants.map((p) => p.userId),
          15,
        ),
      )
    }
  }
}
