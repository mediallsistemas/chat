import { Controller, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../guards/jwt-auth.guard'
import { RolesGuard } from '../guards/roles.guard'
import { UnitScopeGuard } from '../guards/unit-scope.guard'

@Controller('units/:unitId')
@UseGuards(JwtAuthGuard, RolesGuard, UnitScopeGuard)
export abstract class BaseUnitController {}
