import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { HuddlesService } from '../contexts/chat/huddles/huddles.service'

@Injectable()
export class HuddleCleanupJob {
  private readonly logger = new Logger(HuddleCleanupJob.name)

  constructor(private huddlesService: HuddlesService) {}

  // Huddles are ephemeral; close any whose LiveKit room has emptied out but
  // whose client never called /leave (tab closed, crash, process restart).
  @Cron(CronExpression.EVERY_5_MINUTES)
  async closeOrphaned() {
    try {
      const ended = await this.huddlesService.cleanupOrphaned()
      if (ended > 0) this.logger.log(`Closed ${ended} orphaned huddle(s)`)
    } catch (err) {
      this.logger.error('Huddle cleanup failed', (err as Error).stack)
    }
  }
}
