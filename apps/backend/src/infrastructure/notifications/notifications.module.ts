import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { GatewayModule } from '../gateway/gateway.module'
import { MailModule } from '../mail/mail.module'
import { PushModule } from '../push/push.module'
import { ConsentsModule } from '../../consents/consents.module'
import { UsersModule } from '../../users/users.module'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { NotificationSettingsService } from './notification-settings.service'
import { NotificationSettingsController } from './notification-settings.controller'
import { NotifyUserRequestedHandler } from './handlers/notify-user-requested.handler'

@Module({
  imports: [PrismaModule, GatewayModule, MailModule, PushModule, ConsentsModule, UsersModule],
  providers: [NotificationsService, NotificationSettingsService, NotifyUserRequestedHandler],
  controllers: [NotificationsController, NotificationSettingsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
