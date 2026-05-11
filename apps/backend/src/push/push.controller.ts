import { Controller, Get, Post, Delete, Body, Query } from '@nestjs/common'
import { PushService } from './push.service'
import { SubscribePushDto } from './dto/subscribe-push.dto'
import { CurrentUser } from '../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

@Controller('push')
export class PushController {
  constructor(private pushService: PushService) {}

  @Get('public-key')
  getPublicKey() {
    return this.pushService.getPublicKey()
  }

  @Post('subscribe')
  subscribe(@CurrentUser() user: JwtPayload, @Body() dto: SubscribePushDto) {
    return this.pushService.subscribe(user.sub, dto)
  }

  @Delete('unsubscribe')
  unsubscribe(@CurrentUser() user: JwtPayload, @Query('endpoint') endpoint: string) {
    return this.pushService.unsubscribe(user.sub, endpoint)
  }
}
