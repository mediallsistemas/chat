import { Module } from '@nestjs/common'
import { TranscriptionController } from './transcription.controller'
import { TranscriptionService } from './transcription.service'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsModule } from '../infrastructure/notifications/notifications.module'

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [TranscriptionController],
  providers: [TranscriptionService],
})
export class TranscriptionModule {}
