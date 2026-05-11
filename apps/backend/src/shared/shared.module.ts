import { Global, Module } from '@nestjs/common'
import { EventBusService } from './events/event-bus.service'

@Global()
@Module({
  providers: [EventBusService],
  exports: [EventBusService],
})
export class SharedModule {}
