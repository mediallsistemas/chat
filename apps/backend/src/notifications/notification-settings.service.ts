import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto'
import { NotificationType } from '@mediall/types'

const DEFAULT_EMAIL_TYPES: NotificationType[] = [
  NotificationType.TASK_ASSIGNED,
  NotificationType.TASK_OVERDUE,
  NotificationType.IMPEDIMENT_ESCALATED,
  NotificationType.PHASE_UNLOCKED,
  NotificationType.MEETING_REMINDER,
]

@Injectable()
export class NotificationSettingsService {
  constructor(private prisma: PrismaService) {}

  async getOrCreate(userId: string) {
    return this.prisma.notificationSetting.upsert({
      where: { userId },
      create: { userId, emailTypes: DEFAULT_EMAIL_TYPES },
      update: {},
    })
  }

  async update(userId: string, dto: UpdateNotificationSettingsDto) {
    return this.prisma.notificationSetting.upsert({
      where: { userId },
      create: { userId, emailTypes: DEFAULT_EMAIL_TYPES, ...dto },
      update: dto,
    })
  }

  async isInDnd(userId: string): Promise<boolean> {
    const setting = await this.prisma.notificationSetting.findUnique({ where: { userId } })
    if (!setting?.dndEnabled || !setting.dndStart || !setting.dndEnd) return false

    const now = new Date()
    const [startH, startM] = setting.dndStart.split(':').map(Number)
    const [endH, endM] = setting.dndEnd.split(':').map(Number)
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes
    }
    // Overnight (e.g. 22:00 – 08:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  }

  async shouldSendEmail(userId: string, type: NotificationType): Promise<boolean> {
    const setting = await this.prisma.notificationSetting.findUnique({ where: { userId } })
    if (!setting) return true
    if (!setting.emailEnabled) return false
    if (setting.emailTypes.length === 0) return true
    return setting.emailTypes.includes(type)
  }

  async shouldSendPush(userId: string): Promise<boolean> {
    const setting = await this.prisma.notificationSetting.findUnique({ where: { userId } })
    return setting?.pushEnabled ?? true
  }

  async muteGroup(userId: string, groupId: string) {
    return this.prisma.groupMember.updateMany({
      where: { userId, groupId },
      data: { isMuted: true },
    })
  }

  async unmuteGroup(userId: string, groupId: string) {
    return this.prisma.groupMember.updateMany({
      where: { userId, groupId },
      data: { isMuted: false },
    })
  }

  async getMutedGroups(userId: string) {
    const members = await this.prisma.groupMember.findMany({
      where: { userId, isMuted: true },
      select: { groupId: true },
    })
    return members.map((m) => m.groupId)
  }
}
