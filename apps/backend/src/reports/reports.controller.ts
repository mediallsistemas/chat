import { Controller, Get, Param, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ApiTags, ApiOperation, ApiProduces, ApiCookieAuth } from '@nestjs/swagger'
import { ReportsService } from './reports.service'
import { BaseUnitController } from '../shared/controllers/base-unit.controller'
import { CurrentUser } from '../shared/decorators/current-user.decorator'
import { JwtPayload, AccessScope } from '@mediall/types'

@ApiTags('reports')
@ApiCookieAuth('access_token')
@Controller('units/:unitId')
export class ReportsController extends BaseUnitController {
  constructor(private reportsService: ReportsService) {
    super()
  }

  @Get('reports/impediments/pdf')
  @ApiOperation({ summary: 'Export impediments report as PDF' })
  @ApiProduces('application/pdf')
  async impedimentsPdf(
    @Param('unitId') unitId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportImpedimentsPdf(unitId)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="impedimentos-${new Date().toISOString().slice(0, 10)}.pdf"`,
      'Content-Length': String(buffer.length),
    })
    res.end(buffer)
  }

  @Get('reports/impediments/excel')
  @ApiOperation({ summary: 'Export impediments report as Excel (.xlsx)' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async impedimentsExcel(
    @Param('unitId') unitId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportImpedimentsExcel(unitId)
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="impedimentos-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      'Content-Length': String(buffer.length),
    })
    res.end(buffer)
  }

  @Get('reports/dashboard/pdf')
  @ApiOperation({ summary: 'Export executive dashboard report as PDF' })
  @ApiProduces('application/pdf')
  async dashboardPdf(
    @Param('unitId') unitId: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const unitIds = user.accessScope === AccessScope.GLOBAL ? [] : user.units
    const buffer = await this.reportsService.exportDashboardPdf(unitIds)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="relatorio-executivo-${new Date().toISOString().slice(0, 10)}.pdf"`,
      'Content-Length': String(buffer.length),
    })
    res.end(buffer)
  }
}
