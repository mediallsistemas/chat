import { Controller, Get, Post, Param, Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { MacroTasksService } from './macro-tasks.service'
import { CreateMacroTaskDto } from './dto/create-macro-task.dto'
import { BaseUnitController } from '../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../shared/decorators/current-user.decorator'
import { Roles } from '../../shared/decorators/roles.decorator'
import { JwtPayload, UserRole } from '@mediall/types'

@ApiTags('macro-tasks')
@Controller('units/:unitId/phases/:phaseId/macro-tasks')
export class MacroTasksController extends BaseUnitController {
  constructor(private macroTasksService: MacroTasksService) {
    super()
  }

  @Get()
  findAll(@Param('unitId') unitId: string, @Param('phaseId') phaseId: string) {
    return this.macroTasksService.findAll(unitId, phaseId)
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  create(
    @Param('unitId') unitId: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: CreateMacroTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.macroTasksService.create(unitId, phaseId, dto, user)
  }
}
