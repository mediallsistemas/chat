import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import * as webpush from 'web-push'
import { PrismaService } from '../../prisma/prisma.service'
import { SubscribePushDto } from './dto/subscribe-push.dto'

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name)

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    const publicKey = process.env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@mediall.com.br'

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey)
    } else {
      this.logger.warn('VAPID keys not configured — push notifications disabled')
    }
  }

  getPublicKey() {
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? null }
  }

  async subscribe(userId: string, dto: SubscribePushDto) {
    return this.prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint: dto.endpoint } },
      create: { userId, endpoint: dto.endpoint, p256dh: dto.p256dh, auth: dto.auth },
      update: { p256dh: dto.p256dh, auth: dto.auth },
    })
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    })
  }

  async sendToUser(userId: string, payload: { title: string; body: string; url?: string }) {
    if (!process.env.VAPID_PUBLIC_KEY) return

    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } })

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } })
        }
      }
    }
  }
}
