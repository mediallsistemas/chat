import { Controller, Get, Patch, Post, Delete, Param, Body } from '@nestjs/common'
import { NotificationSettingsService } from './notification-settings.service'
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto'
import { CurrentUser } from '../../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

@Controller('notifications/settings')
export class NotificationSettingsController {
  constructor(private settingsService: NotificationSettingsService) {}

  @Get()
  getSettings(@CurrentUser() user: JwtPayload) {
    return this.settingsService.getOrCreate(user.sub)
  }

  @Patch()
  updateSettings(@CurrentUser() user: JwtPayload, @Body() dto: UpdateNotificationSettingsDto) {
    return this.settingsService.update(user.sub, dto)
  }

  @Get('muted-groups')
  getMutedGroups(@CurrentUser() user: JwtPayload) {
    return this.settingsService.getMutedGroups(user.sub)
  }

  @Post('muted-groups/:groupId')
  muteGroup(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.settingsService.muteGroup(user.sub, groupId)
  }

  @Delete('muted-groups/:groupId')
  unmuteGroup(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.settingsService.unmuteGroup(user.sub, groupId)
  }
}
