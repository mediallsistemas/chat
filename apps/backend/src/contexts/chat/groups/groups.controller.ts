import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GroupsService } from './groups.service'
import { CreateGroupDto, AddMemberDto } from './dto/create-group.dto'
import { UpdateGroupDto } from './dto/update-group.dto'
import { UpdateMemberRoleDto } from './dto/update-member-role.dto'
import { BaseUnitController } from '../../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../../shared/decorators/current-user.decorator'
import { Roles } from '../../../shared/decorators/roles.decorator'
import { JwtPayload, UserRole } from '@mediall/types'

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

  @Post('groups/:groupId/read')
  markRead(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.markRead(unitId, groupId, user.sub)
  }

  @Post('groups')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  create(
    @Param('unitId') unitId: string,
    @Body() dto: CreateGroupDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.create(unitId, dto, user)
  }

  @Patch('groups/:groupId/archive')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  archive(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.archive(unitId, groupId, user)
  }

  // Group editing is authorized by the caller's *group role* (ADMIN of the group),
  // checked in the service — not by a system role. A non-admin GESTOR must not edit
  // a group they don't administer.
  @Patch('groups/:groupId')
  update(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.updateGroup(unitId, groupId, dto, user)
  }

  @Patch('groups/:groupId/members/:userId/role')
  updateMemberRole(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.updateMemberRole(unitId, groupId, targetUserId, dto, user)
  }

  @Post('groups/:groupId/members')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
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
