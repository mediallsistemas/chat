import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PlansService } from './plans.service'
import { CreatePlanDto } from './dto/create-plan.dto'
import { UpdatePlanDto } from './dto/update-plan.dto'
import { BaseUnitController } from '../../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../../shared/decorators/current-user.decorator'
import { Roles } from '../../../shared/decorators/roles.decorator'
import { JwtPayload, UserRole } from '@mediall/types'

@ApiTags('plans')
@Controller('units/:unitId/plans')
export class PlansController extends BaseUnitController {
  constructor(private plansService: PlansService) {
    super()
  }

  @Get()
  findAll(@Param('unitId') unitId: string) {
    return this.plansService.findAll(unitId)
  }

  // Must be declared BEFORE `:planId` so "panel" isn't matched as a plan id.
  @Get('panel')
  panel(@Param('unitId') unitId: string) {
    return this.plansService.getPanel(unitId)
  }

  @Get(':planId')
  findOne(@Param('unitId') unitId: string, @Param('planId') planId: string) {
    return this.plansService.findOne(unitId, planId)
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  create(
    @Param('unitId') unitId: string,
    @Body() dto: CreatePlanDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.plansService.create(unitId, dto, user)
  }

  @Patch(':planId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  update(
    @Param('unitId') unitId: string,
    @Param('planId') planId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plansService.update(unitId, planId, dto)
  }

  @Patch(':planId/activate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  activate(@Param('unitId') unitId: string, @Param('planId') planId: string) {
    return this.plansService.activate(unitId, planId)
  }

  @Patch(':planId/archive')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  archive(@Param('unitId') unitId: string, @Param('planId') planId: string) {
    return this.plansService.archive(unitId, planId)
  }
}
