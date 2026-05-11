import { Module } from '@nestjs/common'
import { ImpedimentsController } from './impediments.controller'
import { ImpedimentsService } from './impediments.service'
import { ImpedimentNotificationHandler } from './handlers/impediment-notification.handler'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [ImpedimentsController],
  providers: [ImpedimentsService, ImpedimentNotificationHandler],
  exports: [ImpedimentsService],
})
export class ImpedimentsModule {}
