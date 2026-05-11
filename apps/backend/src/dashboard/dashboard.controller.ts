import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger'
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
}
