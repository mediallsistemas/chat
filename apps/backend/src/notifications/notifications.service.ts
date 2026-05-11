import { Injectable, Logger } from '@nestjs/common'
import { ConsentType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AppGateway } from '../gateway/app.gateway'
import { MailService } from '../mail/mail.service'
import { PushService } from '../push/push.service'
import { NotificationSettingsService } from './notification-settings.service'
import { ConsentsService } from '../consents/consents.service'
import { CreateNotificationDto } from './dto/create-notification.dto'

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private prisma: PrismaService,
    private gateway: AppGateway,
    private mail: MailService,
    private push: PushService,
    private settings: NotificationSettingsService,
    private consents: ConsentsService,
  ) {}

  async create(dto: CreateNotificationDto) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 90)

    const notification = await this.prisma.notification.create({ data: { ...dto, expiresAt } })

    // In-app socket push (always)
    this.gateway.emitToUser(dto.userId, 'notification:new', notification)

    const inDnd = await this.settings.isInDnd(dto.userId)

    if (!inDnd) {
      // Web Push
      const shouldPush = await this.settings.shouldSendPush(dto.userId)
      const hasPushConsent = await this.consents.hasConsent(dto.userId, ConsentType.PUSH_NOTIFICATIONS)
      if (shouldPush && hasPushConsent) {
        this.push
          .sendToUser(dto.userId, { title: dto.title, body: dto.body })
          .catch((err: Error) => this.logger.error('Push notification failed', err.stack))
      }

      // Email (critical events only, per user preference)
      const shouldEmail = await this.settings.shouldSendEmail(dto.userId, dto.type)
      const hasEmailConsent = await this.consents.hasConsent(dto.userId, ConsentType.EMAIL_COMMUNICATIONS)
      if (shouldEmail && hasEmailConsent) {
        const user = await this.prisma.user.findUnique({
          where: { id: dto.userId },
          select: { email: true, name: true },
        })
        if (user) {
          this.mail
            .sendNotification({ to: user.email, name: user.name, type: dto.type, title: dto.title, body: dto.body })
            .catch((err: Error) => this.logger.error('Email delivery failed', err.stack))
        }
      }
    }

    return notification
  }

  async notifyMany(notifications: CreateNotificationDto[]) {
    for (const dto of notifications) {
      await this.create(dto)
    }
  }

  async findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } })
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.update({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
  }
}
