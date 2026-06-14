import { Controller, Post, Get, Param } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { HuddlesService } from './huddles.service'
import { BaseUnitController } from '../../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

@ApiTags('chat-huddles')
@Controller('units/:unitId')
export class HuddlesController extends BaseUnitController {
  constructor(private huddlesService: HuddlesService) {
    super()
  }

  @Get('groups/:groupId/huddle')
  findActive(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.huddlesService.findActiveForGroup(unitId, groupId)
  }

  @Post('groups/:groupId/huddle/start')
  start(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.huddlesService.start(unitId, groupId, user)
  }

  @Post('huddles/:huddleId/join')
  join(
    @Param('unitId') unitId: string,
    @Param('huddleId') huddleId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.huddlesService.join(unitId, huddleId, user)
  }

  @Post('huddles/:huddleId/leave')
  leave(@Param('huddleId') huddleId: string) {
    return this.huddlesService.leave(huddleId)
  }
}
