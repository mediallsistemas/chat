import { Module } from '@nestjs/common'
import { TicketsController } from './tickets.controller'
import { TicketsService } from './tickets.service'
import { TicketNotificationHandler } from './handlers/ticket-notification.handler'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [TicketsController],
  providers: [TicketsService, TicketNotificationHandler],
})
export class TicketsModule {}
