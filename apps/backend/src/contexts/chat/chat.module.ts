import { Module } from '@nestjs/common'
import { GroupsService } from './groups/groups.service'
import { GroupsController } from './groups/groups.controller'
import { MessagesService } from './messages/messages.service'
import { MessagesController } from './messages/messages.controller'
import { PresenceController } from './presence/presence.controller'
import { BookmarksService } from './bookmarks/bookmarks.service'
import { BookmarksController } from './bookmarks/bookmarks.controller'
import { PrismaModule } from '../../prisma/prisma.module'
import { FilesModule } from '../../infrastructure/files/files.module'
import { GatewayModule } from '../../infrastructure/gateway/gateway.module'

@Module({
  imports: [PrismaModule, FilesModule, GatewayModule],
  controllers: [GroupsController, MessagesController, PresenceController, BookmarksController],
  providers: [GroupsService, MessagesService, BookmarksService],
  exports: [GroupsService],
})
export class ChatModule {}
