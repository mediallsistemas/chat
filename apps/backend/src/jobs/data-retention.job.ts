import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class DataRetentionJob {
  private readonly logger = new Logger(DataRetentionJob.name)

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run() {
    this.logger.log('Data retention job started')

    const results = await Promise.allSettled([
      this.purgeNotifications(),
      this.purgeExpiredMessages(),
      this.purgeOldAuditLogs(),
    ])

    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        this.logger.error(`Retention task ${i} failed`, result.reason)
      }
    })

    this.logger.log('Data retention job completed')
  }

  private async purgeNotifications() {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const { count } = await this.prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } })
    this.logger.log(`Purged ${count} old notifications`)
  }

  private async purgeExpiredMessages() {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 2)
    const { count } = await this.prisma.message.deleteMany({
      where: { createdAt: { lt: cutoff }, group: { type: 'TEMPORARY' } },
    })
    this.logger.log(`Purged ${count} old temporary group messages`)
  }

  private async purgeOldAuditLogs() {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 5)
    const { count } = await this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
    this.logger.log(`Purged ${count} old audit logs`)
  }
}
