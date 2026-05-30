import { Module } from '@nestjs/common'
import { ImpedimentsController } from './impediments.controller'
import { ImpedimentsService } from './impediments.service'
import { ImpedimentNotificationHandler } from './handlers/impediment-notification.handler'

@Module({
  controllers: [ImpedimentsController],
  providers: [ImpedimentsService, ImpedimentNotificationHandler],
  exports: [ImpedimentsService],
})
export class ImpedimentsModule {}
