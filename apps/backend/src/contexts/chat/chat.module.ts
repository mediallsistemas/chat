import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { GroupsService } from './groups/groups.service'
import { GroupsController } from './groups/groups.controller'
import { MessagesService } from './messages/messages.service'
import { MessagesController } from './messages/messages.controller'
import { PresenceController } from './presence/presence.controller'
import { BookmarksService } from './bookmarks/bookmarks.service'
import { BookmarksController } from './bookmarks/bookmarks.controller'
import { CustomEmojisService } from './custom-emojis/custom-emojis.service'
import { CustomEmojisController } from './custom-emojis/custom-emojis.controller'
import { RemindersService } from './reminders/reminders.service'
import { RemindersController } from './reminders/reminders.controller'
import { RemindersProcessor } from './reminders/reminders.processor'
import { SearchService } from './search/search.service'
import { SearchController } from './search/search.controller'
import { HuddlesService } from './huddles/huddles.service'
import { HuddlesController } from './huddles/huddles.controller'
import { GroupSystemEventService } from './groups/group-system-event.service'
import { ManagementToChatHandler } from './handlers/management-to-chat.handler'
import { PrismaModule } from '../../prisma/prisma.module'
import { FilesModule } from '../../infrastructure/files/files.module'
import { GatewayModule } from '../../infrastructure/gateway/gateway.module'

@Module({
  imports: [
    PrismaModule,
    FilesModule,
    GatewayModule,
    BullModule.registerQueue({ name: 'chat-reminders' }),
  ],
  controllers: [
    GroupsController,
    MessagesController,
    PresenceController,
    BookmarksController,
    CustomEmojisController,
    RemindersController,
    SearchController,
    HuddlesController,
  ],
  providers: [
    GroupsService,
    MessagesService,
    BookmarksService,
    CustomEmojisService,
    RemindersService,
    RemindersProcessor,
    SearchService,
    HuddlesService,
    GroupSystemEventService,
    ManagementToChatHandler,
  ],
  exports: [GroupsService, HuddlesService],
})
export class ChatModule {}
