import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { GatewayModule } from '../gateway/gateway.module'
import { MailModule } from '../mail/mail.module'
import { PushModule } from '../push/push.module'
import { ConsentsModule } from '../consents/consents.module'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { NotificationSettingsService } from './notification-settings.service'
import { NotificationSettingsController } from './notification-settings.controller'

@Module({
  imports: [PrismaModule, GatewayModule, MailModule, PushModule, ConsentsModule],
  providers: [NotificationsService, NotificationSettingsService],
  controllers: [NotificationsController, NotificationSettingsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
