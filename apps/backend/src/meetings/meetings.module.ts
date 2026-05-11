import { Module } from '@nestjs/common'
import { MeetingsService } from './meetings.service'
import { MeetingsController } from './meetings.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { GatewayModule } from '../gateway/gateway.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [PrismaModule, GatewayModule, NotificationsModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
