import { Module } from '@nestjs/common'
import { GroupsService } from './groups/groups.service'
import { GroupsController } from './groups/groups.controller'
import { MessagesService } from './messages/messages.service'
import { MessagesController } from './messages/messages.controller'
import { PresenceController } from './presence/presence.controller'
import { PrismaModule } from '../../prisma/prisma.module'
import { FilesModule } from '../../infrastructure/files/files.module'
import { NotificationsModule } from '../../infrastructure/notifications/notifications.module'
import { GatewayModule } from '../../infrastructure/gateway/gateway.module'

@Module({
  imports: [PrismaModule, FilesModule, NotificationsModule, GatewayModule],
  controllers: [GroupsController, MessagesController, PresenceController],
  providers: [GroupsService, MessagesService],
  exports: [GroupsService],
})
export class ChatModule {}
