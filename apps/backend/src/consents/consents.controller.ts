import { Controller, Get, Post, Body, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { ConsentsService } from './consents.service'
import { UpdateConsentDto } from './dto/update-consent.dto'
import { CurrentUser } from '../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

@ApiTags('consents')
@Controller('consents')
export class ConsentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  @Get('me')
  getMyConsents(@CurrentUser() user: JwtPayload) {
    return this.consentsService.getConsents(user.sub)
  }

  @Post('me')
  updateConsent(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateConsentDto,
    @Req() req: Request,
  ) {
    return this.consentsService.upsertConsent(user.sub, dto.type, dto.accepted, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    })
  }
}
