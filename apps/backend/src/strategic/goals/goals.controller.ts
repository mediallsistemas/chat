import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GoalsService } from './goals.service'
import { CreateGoalDto } from './dto/create-goal.dto'
import { UpdateGoalDto } from './dto/update-goal.dto'
import { BaseUnitController } from '../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../shared/decorators/current-user.decorator'
import { Roles } from '../../shared/decorators/roles.decorator'
import { JwtPayload, UserRole } from '@mediall/types'

@ApiTags('goals')
@Controller('units/:unitId/objectives/:objectiveId/goals')
export class GoalsController extends BaseUnitController {
  constructor(private goalsService: GoalsService) {
    super()
  }

  @Get()
  findAll(@Param('unitId') unitId: string, @Param('objectiveId') objectiveId: string) {
    return this.goalsService.findAll(unitId, objectiveId)
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  create(
    @Param('unitId') unitId: string,
    @Param('objectiveId') objectiveId: string,
    @Body() dto: CreateGoalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.goalsService.create(unitId, objectiveId, dto, user)
  }

  @Patch(':goalId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  update(
    @Param('unitId') unitId: string,
    @Param('objectiveId') objectiveId: string,
    @Param('goalId') goalId: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(unitId, objectiveId, goalId, dto)
  }
}
