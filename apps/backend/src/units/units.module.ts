import { Module } from '@nestjs/common'
import { UnitsController } from './units.controller'
import { UnitsService } from './units.service'
import { UnitsReadService } from './units-read.service'
import { UNITS_READ_PORT } from '../shared/ports'

@Module({
  controllers: [UnitsController],
  providers: [
    UnitsService,
    UnitsReadService,
    { provide: UNITS_READ_PORT, useExisting: UnitsReadService },
  ],
  exports: [UnitsService, UNITS_READ_PORT],
})
export class UnitsModule {}
