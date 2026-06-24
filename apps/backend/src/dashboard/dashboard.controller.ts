import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiQuery, ApiParam } from '@nestjs/swagger'
import { DashboardService } from './dashboard.service'
import { CurrentUser } from '../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

@ApiTags('dashboard')
@ApiCookieAuth('access_token')
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get executive dashboard summary', description: 'Returns metrics, plans, units and open impediments scoped to the authenticated user. Results are cached for 30 seconds.' })
  @ApiResponse({ status: 200, description: 'Dashboard summary returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getSummary(user)
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get dashboard time-series', description: 'Weekly task completion (burn-up), impediments opened vs resolved, and the plan-progress evolution series (from daily snapshots), scoped to the authenticated user. Pass `unitId` to narrow to a single unit. Cached for 60 seconds.' })
  @ApiQuery({ name: 'unitId', required: false, description: 'Narrow the series to a single unit (header "uma unidade" scope).' })
  @ApiResponse({ status: 200, description: 'Dashboard trends returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — no access to the requested unit' })
  getTrends(@CurrentUser() user: JwtPayload, @Query('unitId') unitId?: string) {
    return this.dashboardService.getTrends(user, unitId)
  }

  @Get('units/:unitId')
  @ApiOperation({ summary: 'Get single-unit dashboard detail', description: 'Metrics, active plans (with this unit\'s objectives) and open impediments scoped to one unit. Drives the scope-aware dashboard when a single unit is selected. Cached for 30 seconds.' })
  @ApiParam({ name: 'unitId', description: 'Target unit id' })
  @ApiResponse({ status: 200, description: 'Unit dashboard detail returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — no access to the requested unit' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  getUnitDetail(@CurrentUser() user: JwtPayload, @Param('unitId', ParseUUIDPipe) unitId: string) {
    return this.dashboardService.getUnitDetail(user, unitId)
  }
}
