import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ConsentType } from '@prisma/client'

@Injectable()
export class ConsentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getConsents(userId: string) {
    return this.prisma.userConsent.findMany({
      where: { userId },
      orderBy: { acceptedAt: 'desc' },
    })
  }

  async upsertConsent(
    userId: string,
    type: ConsentType,
    accepted: boolean,
    meta: { ip?: string; userAgent?: string },
  ) {
    return this.prisma.userConsent.upsert({
      where: { userId_type_version: { userId, type, version: '1.0' } },
      create: { userId, type, accepted, ip: meta.ip, userAgent: meta.userAgent, revokedAt: accepted ? null : new Date() },
      update: { accepted, revokedAt: accepted ? null : new Date() },
    })
  }

  async hasConsent(userId: string, type: ConsentType): Promise<boolean> {
    const consent = await this.prisma.userConsent.findFirst({
      where: { userId, type, accepted: true, revokedAt: null },
    })
    return !!consent
  }
}
