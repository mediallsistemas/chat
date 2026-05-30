import { Module } from '@nestjs/common'
import { MeetingsService } from './meetings.service'
import { MeetingsController } from './meetings.controller'
import { InternalMeetingsController } from './internal-meetings.controller'
import { MeetingNotificationHandler } from './handlers/meeting-notification.handler'
import { MeetingChatService } from './chat/meeting-chat.service'
import { MeetingChatController } from './chat/meeting-chat.controller'
import { PrismaModule } from '../../prisma/prisma.module'
import { GatewayModule } from '../../infrastructure/gateway/gateway.module'

@Module({
  imports: [PrismaModule, GatewayModule],
  controllers: [MeetingsController, InternalMeetingsController, MeetingChatController],
  providers: [MeetingsService, MeetingNotificationHandler, MeetingChatService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
