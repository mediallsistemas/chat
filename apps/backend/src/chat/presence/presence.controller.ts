import { Controller, Get, Param } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { BaseUnitController } from '../../shared/controllers/base-unit.controller'
import { AppGateway } from '../../gateway/app.gateway'

@ApiTags('presence')
@Controller('units/:unitId')
export class PresenceController extends BaseUnitController {
  constructor(private gateway: AppGateway) {
    super()
  }

  @Get('presence')
  getOnline(@Param('unitId') _unitId: string) {
    return { onlineUserIds: this.gateway.getOnlineUserIds() }
  }
}
