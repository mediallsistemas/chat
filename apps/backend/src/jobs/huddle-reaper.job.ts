import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { HuddlesService } from '../contexts/chat/huddles/huddles.service'

/**
 * Reconciles open huddles against LiveKit and ends the stale ones — empty
 * rooms (a participant closed their tab without leaving) and calls left with
 * <= 1 participant past the idle timeout. Runs frequently because huddles are
 * short-lived and presence must reflect reality, not an in-memory guess.
 */
@Injectable()
export class HuddleReaperJob {
  private readonly logger = new Logger(HuddleReaperJob.name)

  constructor(private huddlesService: HuddlesService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async reap() {
    try {
      await this.huddlesService.reapStale()
    } catch (err) {
      this.logger.error('Huddle reaper failed', (err as Error).stack)
    }
  }
}
