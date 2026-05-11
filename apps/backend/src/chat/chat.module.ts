import { Module } from '@nestjs/common'
import { GroupsService } from './groups/groups.service'
import { GroupsController } from './groups/groups.controller'
import { MessagesService } from './messages/messages.service'
import { MessagesController } from './messages/messages.controller'
import { PresenceController } from './presence/presence.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { GatewayModule } from '../gateway/gateway.module'
import { FilesModule } from '../files/files.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [PrismaModule, GatewayModule, FilesModule, NotificationsModule],
  controllers: [GroupsController, MessagesController, PresenceController],
  providers: [GroupsService, MessagesService],
  exports: [GroupsService],
})
export class ChatModule {}
