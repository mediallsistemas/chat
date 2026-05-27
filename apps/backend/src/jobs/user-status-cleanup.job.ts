import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { UsersService } from '../users/users.service'

@Injectable()
export class UserStatusCleanupJob {
  private readonly logger = new Logger(UserStatusCleanupJob.name)

  constructor(private usersService: UsersService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async clearExpired() {
    try {
      const count = await this.usersService.clearExpiredStatuses()
      if (count > 0) this.logger.log(`Cleared ${count} expired user status(es)`)
    } catch (err) {
      this.logger.error('User status cleanup failed', (err as Error).stack)
    }
  }
}
