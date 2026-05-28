import { Module } from '@nestjs/common'
import { MeController } from './me.controller'
import { MeService } from './me.service'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
