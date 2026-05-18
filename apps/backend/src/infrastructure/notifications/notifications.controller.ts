import { Controller, Get, Patch, Param, HttpCode, HttpStatus } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { CurrentUser } from '../../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.findAll(user.sub)
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getUnreadCount(user.sub)
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.markRead(id, user.sub)
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllRead(user.sub)
  }
}
