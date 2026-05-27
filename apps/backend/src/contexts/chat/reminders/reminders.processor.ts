import { Processor, Process } from '@nestjs/bull'
import { Job } from 'bull'
import { Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { EventBusService, NotifyUserRequested } from '../../../shared/events'
import { NotificationType } from '@mediall/types'
import { ReminderJobData } from './reminders.service'

@Processor('chat-reminders')
export class RemindersProcessor {
  private readonly logger = new Logger(RemindersProcessor.name)

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  @Process('fire-reminder')
  async fire(job: Job<ReminderJobData>) {
    const reminder = await this.prisma.chatReminder.findUnique({
      where: { id: job.data.reminderId },
    })
    if (!reminder || reminder.fired) return

    this.eventBus.publish(
      new NotifyUserRequested({
        userId: reminder.userId,
        unitId: reminder.unitId,
        type: NotificationType.CHECKIN_REQUEST as any,
        title: 'Lembrete',
        body: reminder.text,
        entityType: reminder.groupId ? 'chat-group' : undefined,
        entityId: reminder.groupId ?? undefined,
      }),
    )

    await this.prisma.chatReminder.update({
      where: { id: reminder.id },
      data: { fired: true },
    })

    this.logger.log(`Reminder ${reminder.id} fired for user ${reminder.userId}`)
  }
}
