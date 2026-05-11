import { Module } from '@nestjs/common'
import { ImpedimentsController } from './impediments.controller'
import { ImpedimentsService } from './impediments.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [ImpedimentsController],
  providers: [ImpedimentsService],
  exports: [ImpedimentsService],
})
export class ImpedimentsModule {}
