import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Response } from 'express'
import { PlatformTenantsService } from './platform-tenants.service'
import { ChangeTierDto } from './dto/change-tier.dto'
import { PlatformAdminGuard } from '../guards/platform-admin.guard'
import { AllowSuspended } from '../../../shared/decorators/allow-suspended.decorator'
import { CurrentUser } from '../../../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

/**
 * Platform-admin panel (plano 26.5): manage every tenant. Behind
 * `PlatformAdminGuard` (on top of the global stack). `@AllowSuspended()` because
 * platform actions must never be blocked by the admin's own tenant billing state.
 * No `@Roles()` — authorization is the platform flag, re-checked against the DB.
 */
@ApiTags('platform')
@Controller('platform/tenants')
@UseGuards(PlatformAdminGuard)
@AllowSuspended()
export class PlatformTenantsController {
  constructor(private service: PlatformTenantsService) {}

  @Get()
  list() {
    return this.service.list()
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id)
  }

  @Post(':id/suspend')
  suspend(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.suspend(id, user.sub)
  }

  @Post(':id/reactivate')
  reactivate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.reactivate(id, user.sub)
  }

  @Patch(':id/tier')
  changeTier(
    @Param('id') id: string,
    @Body() dto: ChangeTierDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.changeTier(id, dto.tier, user.sub)
  }

  @Post(':id/impersonate')
  impersonate(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.service.impersonate(id, user, res)
  }
}
