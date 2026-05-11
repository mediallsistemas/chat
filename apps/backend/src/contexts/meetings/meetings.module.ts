import { Module } from '@nestjs/common'
import { MeetingsService } from './meetings.service'
import { MeetingsController } from './meetings.controller'
import { MeetingNotificationHandler } from './handlers/meeting-notification.handler'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingNotificationHandler],
  exports: [MeetingsService],
})
export class MeetingsModule {}
