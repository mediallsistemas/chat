import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ObjectivesService } from './objectives.service'
import { CreateObjectiveDto } from './dto/create-objective.dto'
import { UpdateObjectiveDto } from './dto/update-objective.dto'
import { BaseUnitController } from '../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../shared/decorators/current-user.decorator'
import { Roles } from '../../shared/decorators/roles.decorator'
import { JwtPayload, UserRole } from '@mediall/types'

@ApiTags('objectives')
@Controller('units/:unitId/plans/:planId/objectives')
export class ObjectivesController extends BaseUnitController {
  constructor(private objectivesService: ObjectivesService) {
    super()
  }

  @Get()
  findAll(@Param('unitId') unitId: string, @Param('planId') planId: string) {
    return this.objectivesService.findAll(unitId, planId)
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  create(
    @Param('unitId') unitId: string,
    @Param('planId') planId: string,
    @Body() dto: CreateObjectiveDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.objectivesService.create(unitId, planId, dto, user)
  }

  @Patch(':objectiveId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  update(
    @Param('unitId') unitId: string,
    @Param('planId') planId: string,
    @Param('objectiveId') objectiveId: string,
    @Body() dto: UpdateObjectiveDto,
  ) {
    return this.objectivesService.update(unitId, planId, objectiveId, dto)
  }
}
