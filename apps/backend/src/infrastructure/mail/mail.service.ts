import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { NotificationType } from '@mediall/types'

export interface EmailJob {
  to: string
  name: string
  type: NotificationType
  title: string
  body: string
  actionUrl?: string
}

@Injectable()
export class MailService {
  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  async sendNotification(job: EmailJob) {
    await this.emailQueue.add('send-notification', job, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    })
  }
}
