import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GroupsService } from './groups.service'
import { CreateGroupDto, AddMemberDto } from './dto/create-group.dto'
import { BaseUnitController } from '../../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

@ApiTags('groups')
@Controller('units/:unitId')
export class GroupsController extends BaseUnitController {
  constructor(private groupsService: GroupsService) {
    super()
  }

  @Get('groups')
  findAll(@Param('unitId') unitId: string, @CurrentUser() user: JwtPayload) {
    return this.groupsService.findAll(unitId, user.sub)
  }

  @Get('groups/discoverable')
  findDiscoverable(@Param('unitId') unitId: string, @CurrentUser() user: JwtPayload) {
    return this.groupsService.findDiscoverable(unitId, user.sub)
  }

  @Post('groups/:groupId/join')
  join(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.join(unitId, groupId, user.sub)
  }

  @Get('groups/:groupId')
  findOne(@Param('unitId') unitId: string, @Param('groupId') groupId: string) {
    return this.groupsService.findOne(unitId, groupId)
  }

  @Post('groups')
  create(
    @Param('unitId') unitId: string,
    @Body() dto: CreateGroupDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.create(unitId, dto, user)
  }

  @Patch('groups/:groupId/archive')
  archive(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.archive(unitId, groupId, user)
  }

  @Post('groups/:groupId/members')
  addMember(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.addMember(unitId, groupId, dto, user)
  }

  @Delete('groups/:groupId/members/:userId')
  removeMember(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.removeMember(unitId, groupId, userId, user)
  }

  @Post('groups/direct')
  findOrCreateDirect(
    @Param('unitId') unitId: string,
    @Body('targetUserId') targetUserId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.findOrCreateDirect(unitId, user.sub, targetUserId)
  }
}
