import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { GroupsService } from '../contexts/chat/groups/groups.service'

@Injectable()
export class GroupArchiveJob {
  private readonly logger = new Logger(GroupArchiveJob.name)

  constructor(private groupsService: GroupsService) {}

  @Cron('55 23 * * *')
  async archiveExpired() {
    this.logger.log('Group archive job started')
    try {
      await this.groupsService.archiveExpired()
      this.logger.log('Group archive job completed')
    } catch (err) {
      this.logger.error('Group archive job failed', (err as Error).stack)
    }
  }
}
