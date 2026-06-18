import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { PlansService } from './plans.service'
import { AttachUnitsDto } from './dto/attach-units.dto'
import { CurrentUser } from '../../../shared/decorators/current-user.decorator'
import { Roles } from '../../../shared/decorators/roles.decorator'
import { JwtPayload, UserRole } from '@mediall/types'

/**
 * Gestão tenant-wide de planos (plano 24.2). Diferente do `PlansController`
 * (que é por unidade, via `BaseUnitController`), estas rotas operam no escopo do
 * tenant — o isolamento por tenant é automático (TenantGuard + middleware $use).
 * A rota `DELETE :planId/units/:unitId` tem `:unitId` no path, então o
 * `UnitScopeGuard` ainda valida acesso àquela unidade.
 */
@ApiTags('plans')
@Controller('plans')
export class PlansAdminController {
  constructor(private plansService: PlansService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os planos do tenant com as unidades atreladas' })
  findAll() {
    return this.plansService.findAllForTenant()
  }

  @Get(':planId/units')
  @ApiOperation({ summary: 'Unidades atreladas a um plano' })
  listUnits(@Param('planId') planId: string) {
    return this.plansService.listUnits(planId)
  }

  @Post(':planId/units')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  @ApiOperation({ summary: 'Atrela o plano a uma ou mais unidades' })
  attachUnits(
    @Param('planId') planId: string,
    @Body() dto: AttachUnitsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.plansService.attachUnits(planId, dto.unitIds, user)
  }

  @Delete(':planId/units/:unitId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  @ApiOperation({ summary: 'Remove o plano de uma unidade (desatrela)' })
  detachUnit(@Param('planId') planId: string, @Param('unitId') unitId: string) {
    return this.plansService.detachUnit(planId, unitId)
  }

  @Delete(':planId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  @ApiOperation({ summary: 'Exclui o plano (geral, soft-delete)' })
  remove(@Param('planId') planId: string) {
    return this.plansService.softDelete(planId)
  }
}
