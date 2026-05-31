import { Controller, Get, Post, Patch, Delete, Param, Body, Query, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UpdateStatusDto } from './dto/update-status.dto'
import { ListUsersDto } from './dto/list-users.dto'
import { Roles } from '../shared/decorators/roles.decorator'
import { CurrentUser } from '../shared/decorators/current-user.decorator'
import { UserRole, JwtPayload } from '@mediall/types'

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('search')
  search(@Query('q') q: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.searchByName(q, user)
  }

  @Patch('me/status')
  updateStatus(@Body() dto: UpdateStatusDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.updateStatus(user.sub, dto)
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  findAll(@Query() query: ListUsersDto) {
    return this.usersService.findAll(query, query.role)
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id)
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto)
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto)
  }

  @Patch(':id/unlock')
  @Roles(UserRole.SUPER_ADMIN)
  unlock(@Param('id') id: string) {
    return this.usersService.unlock(id)
  }

  @Delete(':userId/personal-data')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async anonymizeUser(@Param('userId') userId: string, @CurrentUser() requester: JwtPayload) {
    if (userId === requester.sub) throw new ForbiddenException('Cannot anonymize your own account')
    await this.usersService.anonymizeUser(userId, requester.sub)
  }

  @Get(':userId/my-data')
  @Roles(UserRole.SUPER_ADMIN)
  exportUserData(@Param('userId') userId: string) {
    return this.usersService.exportUserData(userId)
  }
}
