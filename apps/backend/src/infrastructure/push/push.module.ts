import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { PushService } from './push.service'
import { PushController } from './push.controller'

@Module({
  imports: [PrismaModule],
  providers: [PushService],
  controllers: [PushController],
  exports: [PushService],
})
export class PushModule {}
