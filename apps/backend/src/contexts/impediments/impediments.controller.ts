import { Controller, Post, Patch, Get, Param, Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ImpedimentsService } from './impediments.service'
import { CreateImpedimentDto, ResolveImpedimentDto } from './dto/create-impediment.dto'
import { BaseUnitController } from '../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../shared/decorators/current-user.decorator'
import { Roles } from '../../shared/decorators/roles.decorator'
import { JwtPayload, UserRole } from '@mediall/types'

@ApiTags('impediments')
@Controller('units/:unitId')
export class ImpedimentsController extends BaseUnitController {
  constructor(private impedimentsService: ImpedimentsService) {
    super()
  }

  @Get('impediments')
  findActive(@Param('unitId') unitId: string) {
    return this.impedimentsService.findActive(unitId)
  }

  @Get('impediments/analytics')
  getAnalytics(@Param('unitId') unitId: string) {
    return this.impedimentsService.getAnalytics(unitId)
  }

  @Post('tasks/:taskId/impediments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  create(
    @Param('unitId') unitId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateImpedimentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.impedimentsService.create(unitId, taskId, dto, user)
  }

  @Patch('impediments/:impedimentId/resolve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  resolve(
    @Param('unitId') unitId: string,
    @Param('impedimentId') impedimentId: string,
    @Body() dto: ResolveImpedimentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.impedimentsService.resolve(unitId, impedimentId, dto, user)
  }

  @Patch('impediments/:impedimentId/escalate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  escalate(
    @Param('unitId') unitId: string,
    @Param('impedimentId') impedimentId: string,
  ) {
    return this.impedimentsService.escalate(unitId, impedimentId)
  }
}
