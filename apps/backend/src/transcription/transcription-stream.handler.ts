import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import {
  STREAM_NAMES,
  CONSUMER_GROUPS,
  TranscriptionCompletedSchema,
  TranscriptionFailedSchema,
  NotifyUserCrossServiceSchema,
} from '@mediall/events'
import { RedisStreamsConsumer } from '../shared/streams/redis-streams-consumer.service'
import { PrismaService } from '../prisma/prisma.service'
import { EventBusService, NotifyUserRequested } from '../shared/events'
import { NotificationType } from '@mediall/types'
import { hostname } from 'os'

/**
 * Subscribes to streams published by transcription-svc and merges results
 * back into the monolith (DB write + downstream notifications).
 *
 * Also subscribes to the cross-service notify_user stream so any extracted
 * service can request a user notification through the monolith's
 * NotificationsService (which still owns push/email delivery).
 */
@Injectable()
export class TranscriptionStreamHandler implements OnModuleInit {
  private readonly logger = new Logger(TranscriptionStreamHandler.name)

  constructor(
    private consumer: RedisStreamsConsumer,
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async onModuleInit() {
    const consumerName = `monolith-${hostname()}-${process.pid}`

    await this.consumer.subscribe({
      stream: STREAM_NAMES.transcription.completed,
      group: CONSUMER_GROUPS.monolith.completedConsumer,
      consumer: consumerName,
      handler: async (_id, payload) => {
        const parsed = TranscriptionCompletedSchema.safeParse(payload)
        if (!parsed.success) {
          this.logger.warn(`invalid TranscriptionCompleted payload`)
          return
        }
        const e = parsed.data
        await this.prisma.meeting.update({
          where: { id: e.meetingId },
          data: {
            transcript: e.transcript,
            transcriptSummary: e.summary,
            transcriptActionItems: { summary: e.summary, keyDecisions: e.keyDecisions, actionItems: e.actionItems },
            transcriptedAt: new Date(),
          },
        })
        this.logger.log(`transcription persisted meeting=${e.meetingId}`)
      },
    })

    await this.consumer.subscribe({
      stream: STREAM_NAMES.transcription.failed,
      group: CONSUMER_GROUPS.monolith.failedConsumer,
      consumer: consumerName,
      handler: async (_id, payload) => {
        const parsed = TranscriptionFailedSchema.safeParse(payload)
        if (!parsed.success) return
        this.logger.warn(`transcription failed meeting=${parsed.data.meetingId} reason=${parsed.data.reason}`)
      },
    })

    await this.consumer.subscribe({
      stream: STREAM_NAMES.notifications.notifyUser,
      group: 'monolith-notify-user-cross-service',
      consumer: consumerName,
      handler: async (_id, payload) => {
        const parsed = NotifyUserCrossServiceSchema.safeParse(payload)
        if (!parsed.success) {
          this.logger.warn('invalid NotifyUserCrossService payload')
          return
        }
        const e = parsed.data
        this.eventBus.publish(
          new NotifyUserRequested({
            userId: e.userId,
            unitId: e.unitId,
            type: e.type as NotificationType,
            title: e.title,
            body: e.body,
            entityType: e.entityType,
            entityId: e.entityId,
          }),
        )
      },
    })

    this.logger.log('transcription stream handlers subscribed')
  }
}
