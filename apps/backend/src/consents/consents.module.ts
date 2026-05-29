import { Module } from '@nestjs/common'
import { ConsentsController } from './consents.controller'
import { ConsentsService } from './consents.service'
import { PrismaModule } from '../prisma/prisma.module'
import { CONSENT_READ_PORT } from '../shared/ports'

@Module({
  imports: [PrismaModule],
  controllers: [ConsentsController],
  providers: [
    ConsentsService,
    { provide: CONSENT_READ_PORT, useExisting: ConsentsService },
  ],
  exports: [ConsentsService, CONSENT_READ_PORT],
})
export class ConsentsModule {}
