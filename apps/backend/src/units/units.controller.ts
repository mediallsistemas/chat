import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { UnitsService } from './units.service'
import { CreateUnitDto } from './dto/create-unit.dto'
import { AssignUserDto } from './dto/assign-user.dto'
import { Roles } from '../shared/decorators/roles.decorator'
import { CurrentUser } from '../shared/decorators/current-user.decorator'
import { JwtPayload, UserRole } from '@mediall/types'

@ApiTags('units')
@Controller('units')
export class UnitsController {
  constructor(private unitsService: UnitsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.unitsService.findAll(user)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.unitsService.findOne(id)
  }

  @Get(':id/members')
  findMembers(@Param('id') id: string) {
    return this.unitsService.findMembers(id)
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateUnitDto) {
    return this.unitsService.create(dto)
  }

  @Post(':id/users')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  assignUser(
    @Param('id') unitId: string,
    @Body() dto: AssignUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.unitsService.assignUser(unitId, dto, user.sub)
  }

  @Delete(':id/users/:userId')
  @Roles(UserRole.SUPER_ADMIN)
  removeUser(@Param('id') unitId: string, @Param('userId') userId: string) {
    return this.unitsService.removeUser(unitId, userId)
  }
}
