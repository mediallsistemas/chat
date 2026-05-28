import { Controller, Get, Param } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { MeService } from './me.service'
import { BaseUnitController } from '../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

@ApiTags('me')
@Controller('units/:unitId')
export class MeController extends BaseUnitController {
  constructor(private meService: MeService) {
    super()
  }

  @Get('me/dashboard')
  getDashboard(@Param('unitId') unitId: string, @CurrentUser() user: JwtPayload) {
    return this.meService.getDashboard(unitId, user)
  }
}
