import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { RemindersService } from './reminders.service'
import { CreateReminderDto } from './dto/create-reminder.dto'
import { BaseUnitController } from '../../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

@ApiTags('chat-reminders')
@Controller('units/:unitId')
export class RemindersController extends BaseUnitController {
  constructor(private remindersService: RemindersService) {
    super()
  }

  @Get('chat/reminders')
  findUpcoming(@Param('unitId') unitId: string, @CurrentUser() user: JwtPayload) {
    return this.remindersService.findUpcoming(unitId, user)
  }

  @Post('chat/reminders')
  create(
    @Param('unitId') unitId: string,
    @Body() dto: CreateReminderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.remindersService.create(unitId, dto, user)
  }

  @Delete('chat/reminders/:id')
  cancel(
    @Param('unitId') unitId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.remindersService.cancel(unitId, id, user)
  }
}
