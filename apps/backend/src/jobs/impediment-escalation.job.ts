import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ImpedimentsService } from '../contexts/impediments/impediments.service'

@Injectable()
export class ImpedimentEscalationJob {
  private readonly logger = new Logger(ImpedimentEscalationJob.name)

  constructor(private impedimentsService: ImpedimentsService) {}

  @Cron('0 8 * * *')
  async escalate() {
    this.logger.log('Impediment escalation job started')
    try {
      await this.impedimentsService.escalatePending()
      this.logger.log('Impediment escalation job completed')
    } catch (err) {
      this.logger.error('Impediment escalation job failed', (err as Error).stack)
    }
  }
}
