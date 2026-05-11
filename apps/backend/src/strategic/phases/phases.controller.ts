import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PhasesService } from './phases.service'
import { CreatePhaseDto } from './dto/create-phase.dto'
import { UpdatePhaseDto } from './dto/update-phase.dto'
import { BaseUnitController } from '../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../shared/decorators/current-user.decorator'
import { Roles } from '../../shared/decorators/roles.decorator'
import { JwtPayload, UserRole } from '@mediall/types'

@ApiTags('phases')
@Controller('units/:unitId/goals/:goalId/phases')
export class PhasesController extends BaseUnitController {
  constructor(private phasesService: PhasesService) {
    super()
  }

  @Get()
  findAll(@Param('unitId') unitId: string, @Param('goalId') goalId: string) {
    return this.phasesService.findAll(unitId, goalId)
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  create(
    @Param('unitId') unitId: string,
    @Param('goalId') goalId: string,
    @Body() dto: CreatePhaseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.phasesService.create(unitId, goalId, dto, user)
  }

  @Patch(':phaseId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  update(
    @Param('unitId') unitId: string,
    @Param('goalId') goalId: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: UpdatePhaseDto,
  ) {
    return this.phasesService.update(unitId, goalId, phaseId, dto)
  }

  @Patch(':phaseId/complete')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  complete(@Param('unitId') unitId: string, @Param('phaseId') phaseId: string) {
    return this.phasesService.complete(unitId, phaseId)
  }
}
