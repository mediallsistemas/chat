import { Module } from '@nestjs/common'
import { ConsentsController } from './consents.controller'
import { ConsentsService } from './consents.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [ConsentsController],
  providers: [ConsentsService],
  exports: [ConsentsService],
})
export class ConsentsModule {}
